const fsSync = require("fs");
const path = require("path");
const fs = require("fs/promises");

const { loadPortfolio, savePortfolio } = require("../scripts/portfolio-store");
const PORTFOLIO_BLOB_META = Symbol("portfolio-blob-meta");
let localEnvCache = null;

function parseEnvContent(content = "") {
  return String(content || "")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = String(line || "").trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        return env;
      }

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      return env;
    }, {});
}

function readLocalEnv(rootDir = process.cwd()) {
  const cacheKey = path.resolve(rootDir);
  if (localEnvCache?.key === cacheKey) {
    return localEnvCache.value;
  }

  const merged = {};
  [".env.local", ".env"].forEach((fileName) => {
    const filePath = path.join(cacheKey, fileName);
    try {
      const content = fsSync.readFileSync(filePath, "utf8");
      Object.assign(merged, parseEnvContent(content));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  });

  localEnvCache = {
    key: cacheKey,
    value: merged,
  };
  return merged;
}

function ensureBlobToken(rootDir = process.cwd()) {
  if (String(process.env.DISABLE_LOCAL_BLOB_ENV || "").trim() === "1") {
    return "";
  }

  const processToken = String(process.env.BLOB_READ_WRITE_TOKEN || "").trim();
  if (processToken) {
    return processToken;
  }

  const localToken = String(readLocalEnv(rootDir).BLOB_READ_WRITE_TOKEN || "").trim();
  if (localToken) {
    process.env.BLOB_READ_WRITE_TOKEN = localToken;
    return localToken;
  }

  return "";
}

function getPortfolioRevision(portfolio = null) {
  return Number(portfolio?.metadata?.stateRevision || 0);
}

function withPortfolioRevision(portfolio = {}, revision = 1) {
  const next = structuredClone(portfolio || {});
  next.metadata = {
    ...(next.metadata || {}),
    stateRevision: Math.max(1, Number(revision || 1)),
  };
  return next;
}

function attachPortfolioBlobMeta(portfolio = null, meta = null) {
  if (!portfolio || !meta) {
    return portfolio;
  }

  Object.defineProperty(portfolio, PORTFOLIO_BLOB_META, {
    value: meta,
    enumerable: false,
    configurable: true,
    writable: true,
  });

  return portfolio;
}

function getPortfolioBlobMeta(portfolio = null) {
  return portfolio?.[PORTFOLIO_BLOB_META] || null;
}

function buildPortfolioBlobPath(stateKey = "owner") {
  return `app-state/${stateKey}/portfolio.json`;
}

function buildNotesBlobPath(stateKey = "owner") {
  return `app-state/${stateKey}/notes.json`;
}

function buildLocalNotesPath(stateKey = "owner") {
  return stateKey === "owner" ? path.join("data", "notes.json") : path.join("data", `notes.${stateKey}.json`);
}

function hasBlobStorage(rootDir = process.cwd()) {
  return Boolean(ensureBlobToken(rootDir));
}

async function loadBlobSdk() {
  return import("@vercel/blob");
}

function isBlobNotFoundError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "BlobNotFoundError" || message.includes("not found");
}

function isBlobPreconditionFailedError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "BlobPreconditionFailedError" || message.includes("precondition");
}

function isBlobAlreadyExistsError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "BlobAlreadyExistsError" || message.includes("already exists");
}

async function readJsonBlob(pathname) {
  const { get } = await loadBlobSdk();

  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const raw = await new Response(result.stream).text();
    return {
      data: raw ? JSON.parse(raw) : null,
      etag: result.blob?.etag || "",
    };
  } catch (error) {
    if (isBlobNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function writeJsonBlob(pathname, payload, options = {}) {
  const { put } = await loadBlobSdk();
  const body = `${JSON.stringify(payload, null, 2)}\n`;

  return put(pathname, body, {
    access: "private",
    allowOverwrite: Boolean(options.allowOverwrite || options.ifMatch),
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    ifMatch: options.ifMatch || undefined,
  });
}

async function loadPersistedPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner") {
  if (!hasBlobStorage(rootDir)) {
    if (stateKey !== "owner" && fallbackPortfolio) {
      return withPortfolioRevision(fallbackPortfolio, getPortfolioRevision(fallbackPortfolio) || 1);
    }

    const localPortfolio = await loadPortfolio(rootDir);
    return withPortfolioRevision(localPortfolio, getPortfolioRevision(localPortfolio) || 1);
  }

  const blobPath = buildPortfolioBlobPath(stateKey);
  const persisted = await readJsonBlob(blobPath);
  if (persisted?.data) {
    const portfolio = withPortfolioRevision(persisted.data, getPortfolioRevision(persisted.data) || 1);
    return attachPortfolioBlobMeta(portfolio, { etag: persisted.etag, pathname: blobPath });
  }

  const seeded = fallbackPortfolio ? structuredClone(fallbackPortfolio) : await loadPortfolio(rootDir);
  const initialPortfolio = withPortfolioRevision(seeded, getPortfolioRevision(seeded) || 1);
  try {
    const blob = await writeJsonBlob(blobPath, initialPortfolio);
    return attachPortfolioBlobMeta(initialPortfolio, { etag: blob?.etag || "", pathname: blobPath });
  } catch (error) {
    if (!isBlobAlreadyExistsError(error)) {
      throw error;
    }

    const concurrentPersisted = await readJsonBlob(blobPath);
    if (concurrentPersisted?.data) {
      const portfolio = withPortfolioRevision(
        concurrentPersisted.data,
        getPortfolioRevision(concurrentPersisted.data) || 1
      );
      return attachPortfolioBlobMeta(portfolio, { etag: concurrentPersisted.etag, pathname: blobPath });
    }

    throw error;
  }
}

async function savePersistedPortfolio(rootDir = process.cwd(), portfolio, stateKey = "owner", options = {}) {
  const expectedRevision = Number.isFinite(Number(options.expectedRevision)) ? Number(options.expectedRevision) : null;
  const expectedEtag = String(options.expectedEtag || "").trim();

  if (!hasBlobStorage(rootDir)) {
    const currentPortfolio = await loadPersistedPortfolio(rootDir, null, stateKey);
    const currentRevision = getPortfolioRevision(currentPortfolio);

    if (expectedRevision != null && currentRevision !== expectedRevision) {
      throw new Error("다른 변경이 먼저 저장되었습니다. 화면을 새로고침한 뒤 다시 시도해주세요.");
    }

    const nextRevision = Math.max(currentRevision, expectedRevision || 0) + 1;
    const nextPortfolio = withPortfolioRevision(portfolio, nextRevision);
    if (stateKey !== "owner") {
      return nextPortfolio;
    }

    await savePortfolio(rootDir, nextPortfolio);
    return nextPortfolio;
  }

  const baseRevision = Math.max(expectedRevision ?? getPortfolioRevision(portfolio), 0);
  const nextPortfolio = withPortfolioRevision(portfolio, baseRevision + 1);

  try {
    const blob = await writeJsonBlob(buildPortfolioBlobPath(stateKey), nextPortfolio, {
      allowOverwrite: true,
      ifMatch: expectedEtag || undefined,
    });
    return attachPortfolioBlobMeta(nextPortfolio, {
      etag: blob?.etag || "",
      pathname: buildPortfolioBlobPath(stateKey),
    });
  } catch (error) {
    if (isBlobPreconditionFailedError(error)) {
      throw new Error("다른 변경이 먼저 저장되었습니다. 화면을 새로고침한 뒤 다시 시도해주세요.");
    }
    throw error;
  }
}

async function loadLocalNotes(rootDir = process.cwd(), stateKey = "owner") {
  try {
    const raw = await fs.readFile(path.join(rootDir, buildLocalNotesPath(stateKey)), "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

async function saveLocalNotes(rootDir = process.cwd(), notes = [], stateKey = "owner") {
  const filePath = path.join(rootDir, buildLocalNotesPath(stateKey));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(Array.isArray(notes) ? notes : [], null, 2)}\n`, "utf8");
}

async function loadPersistedNotes(rootDir = process.cwd(), stateKey = "owner") {
  if (!hasBlobStorage(rootDir)) {
    return loadLocalNotes(rootDir, stateKey);
  }

  const persisted = await readJsonBlob(buildNotesBlobPath(stateKey));
  return Array.isArray(persisted?.data) ? persisted.data : [];
}

async function savePersistedNotes(rootDir = process.cwd(), notes = [], stateKey = "owner") {
  if (!hasBlobStorage(rootDir)) {
    const normalized = Array.isArray(notes) ? notes : [];
    await saveLocalNotes(rootDir, normalized, stateKey);
    return normalized;
  }

  const normalized = Array.isArray(notes) ? notes : [];
  await writeJsonBlob(buildNotesBlobPath(stateKey), normalized, { allowOverwrite: true });
  return normalized;
}

module.exports = {
  hasBlobStorage,
  loadPersistedNotes,
  loadPersistedPortfolio,
  savePersistedNotes,
  savePersistedPortfolio,
  buildNotesBlobPath,
  buildPortfolioBlobPath,
  getPortfolioBlobMeta,
  getPortfolioRevision,
};
