const path = require("path");
const fs = require("fs/promises");

const { loadPortfolio, savePortfolio } = require("../scripts/portfolio-store");

function buildPortfolioBlobPath(stateKey = "owner") {
  return `app-state/${stateKey}/portfolio.json`;
}

function buildNotesBlobPath(stateKey = "owner") {
  return `app-state/${stateKey}/notes.json`;
}

function buildLocalNotesPath(stateKey = "owner") {
  return stateKey === "owner" ? path.join("data", "notes.json") : path.join("data", `notes.${stateKey}.json`);
}

function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function loadBlobSdk() {
  return import("@vercel/blob");
}

function isBlobNotFoundError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "BlobNotFoundError" || message.includes("not found");
}

async function readJsonBlob(pathname) {
  const { get } = await loadBlobSdk();

  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return null;
    }

    const raw = await new Response(result.stream).text();
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    if (isBlobNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

async function writeJsonBlob(pathname, payload) {
  const { put } = await loadBlobSdk();
  const body = `${JSON.stringify(payload, null, 2)}\n`;

  await put(pathname, body, {
    access: "private",
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
  });
}

async function loadPersistedPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner") {
  if (!hasBlobStorage()) {
    return fallbackPortfolio ? structuredClone(fallbackPortfolio) : loadPortfolio(rootDir);
  }

  const persisted = await readJsonBlob(buildPortfolioBlobPath(stateKey));
  if (persisted) {
    return persisted;
  }

  const seeded = fallbackPortfolio ? structuredClone(fallbackPortfolio) : await loadPortfolio(rootDir);
  await writeJsonBlob(buildPortfolioBlobPath(stateKey), seeded);
  return seeded;
}

async function savePersistedPortfolio(rootDir = process.cwd(), portfolio, stateKey = "owner") {
  if (!hasBlobStorage()) {
    await savePortfolio(rootDir, portfolio);
    return portfolio;
  }

  await writeJsonBlob(buildPortfolioBlobPath(stateKey), portfolio);
  return portfolio;
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
  if (!hasBlobStorage()) {
    return loadLocalNotes(rootDir, stateKey);
  }

  const persisted = await readJsonBlob(buildNotesBlobPath(stateKey));
  return Array.isArray(persisted) ? persisted : [];
}

async function savePersistedNotes(rootDir = process.cwd(), notes = [], stateKey = "owner") {
  if (!hasBlobStorage()) {
    const normalized = Array.isArray(notes) ? notes : [];
    await saveLocalNotes(rootDir, normalized, stateKey);
    return normalized;
  }

  const normalized = Array.isArray(notes) ? notes : [];
  await writeJsonBlob(buildNotesBlobPath(stateKey), normalized);
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
};
