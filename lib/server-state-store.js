const fsSync = require("fs");
const path = require("path");
const fs = require("fs/promises");
const { applicationDefault, cert, getApp, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const { loadPortfolio, savePortfolio } = require("../scripts/portfolio-store");

const PORTFOLIO_BLOB_META = Symbol("portfolio-blob-meta");
const FIREBASE_APP_NAME = "asset-main-storage";
const MUTATION_LOG_LIMIT = 60;
const STALE_WRITE_ERROR = "다른 변경이 먼저 저장되었습니다. 화면을 새로고침한 뒤 다시 시도해주세요.";

let localEnvCache = null;
let firestoreCache = null;

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

function readRuntimeEnv(rootDir = process.cwd()) {
  return {
    ...readLocalEnv(rootDir),
    ...process.env,
  };
}

function trimValue(value = "") {
  return String(value || "").trim();
}

function trimFirestorePath(value = "") {
  return trimValue(value).replace(/^\/+|\/+$/g, "");
}

function normalizeMultilineSecret(value = "") {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function normalizeRecentMutationIds(ids = []) {
  const seen = new Set();
  const result = [];
  const input = Array.isArray(ids) ? ids : [];

  for (let index = input.length - 1; index >= 0; index -= 1) {
    const mutationId = trimValue(input[index]);
    if (!mutationId || seen.has(mutationId)) {
      continue;
    }

    seen.add(mutationId);
    result.unshift(mutationId);
    if (result.length >= MUTATION_LOG_LIMIT) {
      break;
    }
  }

  return result;
}

function appendRecentMutationId(ids = [], mutationId = "") {
  const normalizedId = trimValue(mutationId);
  if (!normalizedId) {
    return normalizeRecentMutationIds(ids);
  }

  return normalizeRecentMutationIds([...(Array.isArray(ids) ? ids : []), normalizedId]);
}

function hasRecentMutationId(ids = [], mutationId = "") {
  const normalizedId = trimValue(mutationId);
  return Boolean(normalizedId) && normalizeRecentMutationIds(ids).includes(normalizedId);
}

function getPortfolioRevision(portfolio = null) {
  return Number(portfolio?.metadata?.stateRevision || 0);
}

function withPortfolioRevision(portfolio = {}, revision = 1) {
  const next = structuredClone(portfolio || {});
  next.metadata = {
    ...(next.metadata || {}),
    stateRevision: Math.max(1, Number(revision || 1)),
    recentMutationIds: normalizeRecentMutationIds(next.metadata?.recentMutationIds),
  };
  return next;
}

function hasPortfolioMutationId(portfolio = null, mutationId = "") {
  return hasRecentMutationId(portfolio?.metadata?.recentMutationIds, mutationId);
}

function recordPortfolioMutation(portfolio = {}, mutationId = "") {
  const normalizedId = trimValue(mutationId);
  if (!normalizedId) {
    return withPortfolioRevision(portfolio, getPortfolioRevision(portfolio) || 1);
  }

  const next = withPortfolioRevision(portfolio, getPortfolioRevision(portfolio) || 1);
  next.metadata = {
    ...(next.metadata || {}),
    recentMutationIds: appendRecentMutationId(next.metadata?.recentMutationIds, normalizedId),
    lastMutationId: normalizedId,
    lastMutationAt: new Date().toISOString(),
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

function normalizeNotesStorePayload(payload = null) {
  if (Array.isArray(payload)) {
    return {
      notes: payload,
      metadata: {
        recentMutationIds: [],
      },
    };
  }

  return {
    notes: Array.isArray(payload?.notes) ? payload.notes : [],
    metadata: {
      ...(payload?.metadata || {}),
      recentMutationIds: normalizeRecentMutationIds(payload?.metadata?.recentMutationIds),
    },
  };
}

function buildNotesStorePayload(notes = [], existingPayload = null, mutationId = "") {
  const current = normalizeNotesStorePayload(existingPayload);
  const nextMutationId = trimValue(mutationId);
  const timestamp = new Date().toISOString();

  return {
    notes: Array.isArray(notes) ? notes : [],
    metadata: {
      ...(current.metadata || {}),
      updatedAt: timestamp,
      recentMutationIds: appendRecentMutationId(current.metadata?.recentMutationIds, nextMutationId),
      ...(nextMutationId
        ? {
            lastMutationId: nextMutationId,
            lastMutationAt: timestamp,
          }
        : {}),
    },
  };
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

function ensureBlobToken(rootDir = process.cwd()) {
  if (trimValue(process.env.DISABLE_LOCAL_BLOB_ENV) === "1") {
    return "";
  }

  const processToken = trimValue(process.env.BLOB_READ_WRITE_TOKEN);
  if (processToken) {
    return processToken;
  }

  const localToken = trimValue(readLocalEnv(rootDir).BLOB_READ_WRITE_TOKEN);
  if (localToken) {
    process.env.BLOB_READ_WRITE_TOKEN = localToken;
    return localToken;
  }

  return "";
}

function hasBlobStorage(rootDir = process.cwd()) {
  return Boolean(ensureBlobToken(rootDir));
}

function resolveFirestorePortfolioDocPath(rootDir = process.cwd(), stateKey = "owner") {
  const env = readRuntimeEnv(rootDir);
  const explicitPath = trimFirestorePath(env.FIRESTORE_PORTFOLIO_DOC_PATH || env.FIRESTORE_PORTFOLIO_PATH);
  if (explicitPath) {
    return explicitPath;
  }

  const collectionPath = trimFirestorePath(env.FIRESTORE_PORTFOLIO_COLLECTION_PATH);
  return collectionPath ? `${collectionPath}/${stateKey}` : "";
}

function resolveFirestoreNotesDocPath(rootDir = process.cwd(), stateKey = "owner") {
  const env = readRuntimeEnv(rootDir);
  const explicitPath = trimFirestorePath(env.FIRESTORE_NOTES_DOC_PATH);
  if (explicitPath) {
    return explicitPath;
  }

  const collectionPath = trimFirestorePath(env.FIRESTORE_NOTES_COLLECTION_PATH);
  return collectionPath ? `${collectionPath}/${stateKey}` : "";
}

function hasFirebaseStorage(rootDir = process.cwd(), stateKey = "owner") {
  return Boolean(resolveFirestorePortfolioDocPath(rootDir, stateKey));
}

function getStorageProvider(rootDir = process.cwd(), stateKey = "owner") {
  const env = readRuntimeEnv(rootDir);
  const explicitProvider = trimValue(env.STORAGE_PROVIDER).toLowerCase();
  if (explicitProvider === "firebase" || explicitProvider === "firestore") {
    return "firebase";
  }
  if (explicitProvider === "blob") {
    return "blob";
  }
  if (explicitProvider === "local") {
    return "local";
  }
  if (hasFirebaseStorage(rootDir, stateKey)) {
    return "firebase";
  }
  return hasBlobStorage(rootDir) ? "blob" : "local";
}

function validateFirestoreDocPath(docPath, label) {
  const normalized = trimFirestorePath(docPath);
  if (!normalized) {
    throw new Error(`${label} 환경변수가 비어 있습니다.`);
  }

  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || segments.length % 2 !== 0) {
    throw new Error(`${label}는 'collection/doc' 형태의 Firestore 문서 경로여야 합니다.`);
  }

  return normalized;
}

function isFirestoreAlreadyExistsError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === 6 || message.includes("already exists");
}

function resolveServiceAccountObject(rootDir = process.cwd()) {
  const env = readRuntimeEnv(rootDir);
  const inlineJson = trimValue(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (inlineJson) {
    const parsed = JSON.parse(inlineJson);
    return {
      ...parsed,
      private_key: normalizeMultilineSecret(parsed.private_key || parsed.privateKey || ""),
    };
  }

  const explicitFile = trimValue(env.FIREBASE_SERVICE_ACCOUNT_FILE);
  const defaultFile = path.join(rootDir, "config", "serviceAccountKey.json");
  const serviceAccountPath = explicitFile ? path.resolve(rootDir, explicitFile) : defaultFile;
  if (fsSync.existsSync(serviceAccountPath)) {
    const parsed = JSON.parse(fsSync.readFileSync(serviceAccountPath, "utf8"));
    return {
      ...parsed,
      private_key: normalizeMultilineSecret(parsed.private_key || parsed.privateKey || ""),
    };
  }

  const projectId = trimValue(env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT);
  const clientEmail = trimValue(env.FIREBASE_CLIENT_EMAIL);
  const privateKey = normalizeMultilineSecret(env.FIREBASE_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
  }

  return null;
}

function resolveFirebaseAppOptions(rootDir = process.cwd()) {
  const env = readRuntimeEnv(rootDir);
  const serviceAccount = resolveServiceAccountObject(rootDir);
  const projectId = trimValue(env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || serviceAccount?.project_id);

  return {
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  };
}

async function getFirestoreDb(rootDir = process.cwd()) {
  const cacheKey = path.resolve(rootDir);
  if (firestoreCache?.key === cacheKey) {
    return firestoreCache.db;
  }

  let app = null;
  try {
    app = getApp(FIREBASE_APP_NAME);
  } catch (error) {
    app = initializeApp(resolveFirebaseAppOptions(rootDir), FIREBASE_APP_NAME);
  }

  const db = getFirestore(app);
  firestoreCache = {
    key: cacheKey,
    db,
  };
  return db;
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

async function readFirestoreDoc(rootDir, docPath) {
  const db = await getFirestoreDb(rootDir);
  const ref = db.doc(validateFirestoreDocPath(docPath, "Firestore 문서 경로"));
  const snapshot = await ref.get();
  return {
    ref,
    data: snapshot.exists ? snapshot.data() : null,
  };
}

async function loadPersistedPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner") {
  const provider = getStorageProvider(rootDir, stateKey);

  if (provider === "firebase") {
    const docPath = validateFirestoreDocPath(
      resolveFirestorePortfolioDocPath(rootDir, stateKey),
      "FIRESTORE_PORTFOLIO_DOC_PATH"
    );
    const { ref, data } = await readFirestoreDoc(rootDir, docPath);
    if (data) {
      return withPortfolioRevision(data, getPortfolioRevision(data) || 1);
    }

    const seeded = fallbackPortfolio ? structuredClone(fallbackPortfolio) : await loadPortfolio(rootDir);
    const initialPortfolio = withPortfolioRevision(seeded, getPortfolioRevision(seeded) || 1);

    try {
      await ref.create(initialPortfolio);
      return initialPortfolio;
    } catch (error) {
      if (!isFirestoreAlreadyExistsError(error)) {
        throw error;
      }

      const concurrent = await ref.get();
      if (concurrent.exists && concurrent.data()) {
        return withPortfolioRevision(concurrent.data(), getPortfolioRevision(concurrent.data()) || 1);
      }

      throw error;
    }
  }

  if (provider === "local") {
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
  const expectedEtag = trimValue(options.expectedEtag);
  const mutationId = trimValue(options.mutationId);
  const provider = getStorageProvider(rootDir, stateKey);

  if (provider === "firebase") {
    const db = await getFirestoreDb(rootDir);
    const ref = db.doc(
      validateFirestoreDocPath(resolveFirestorePortfolioDocPath(rootDir, stateKey), "FIRESTORE_PORTFOLIO_DOC_PATH")
    );
    let nextPortfolio = null;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const currentPortfolio = snapshot.exists
        ? withPortfolioRevision(snapshot.data(), getPortfolioRevision(snapshot.data()) || 1)
        : withPortfolioRevision({}, 1);

      if (mutationId && hasPortfolioMutationId(currentPortfolio, mutationId)) {
        nextPortfolio = currentPortfolio;
        return;
      }

      const currentRevision = snapshot.exists ? getPortfolioRevision(currentPortfolio) : 0;
      if (expectedRevision != null && currentRevision !== expectedRevision) {
        throw new Error(STALE_WRITE_ERROR);
      }

      const baseRevision = Math.max(currentRevision, expectedRevision ?? getPortfolioRevision(portfolio), 0);
      nextPortfolio = recordPortfolioMutation(withPortfolioRevision(portfolio, baseRevision + 1), mutationId);
      transaction.set(ref, nextPortfolio);
    });

    return nextPortfolio;
  }

  if (provider === "local") {
    const currentPortfolio = await loadPersistedPortfolio(rootDir, null, stateKey);
    const currentRevision = getPortfolioRevision(currentPortfolio);

    if (mutationId && hasPortfolioMutationId(currentPortfolio, mutationId)) {
      return currentPortfolio;
    }

    if (expectedRevision != null && currentRevision !== expectedRevision) {
      throw new Error(STALE_WRITE_ERROR);
    }

    const nextRevision = Math.max(currentRevision, expectedRevision || 0) + 1;
    const nextPortfolio = recordPortfolioMutation(withPortfolioRevision(portfolio, nextRevision), mutationId);
    if (stateKey !== "owner") {
      return nextPortfolio;
    }

    await savePortfolio(rootDir, nextPortfolio);
    return nextPortfolio;
  }

  const latestPortfolio = mutationId ? await loadPersistedPortfolio(rootDir, null, stateKey) : null;
  if (mutationId && hasPortfolioMutationId(latestPortfolio, mutationId)) {
    return latestPortfolio;
  }

  const baseRevision = Math.max(expectedRevision ?? getPortfolioRevision(portfolio), 0);
  const nextPortfolio = recordPortfolioMutation(withPortfolioRevision(portfolio, baseRevision + 1), mutationId);

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
      const currentPortfolio = await loadPersistedPortfolio(rootDir, null, stateKey);
      if (mutationId && hasPortfolioMutationId(currentPortfolio, mutationId)) {
        return currentPortfolio;
      }
      throw new Error(STALE_WRITE_ERROR);
    }
    throw error;
  }
}

async function loadLocalNotesStore(rootDir = process.cwd(), stateKey = "owner") {
  try {
    const raw = await fs.readFile(path.join(rootDir, buildLocalNotesPath(stateKey)), "utf8");
    return normalizeNotesStorePayload(raw ? JSON.parse(raw) : []);
  } catch (error) {
    if (error.code === "ENOENT") {
      return normalizeNotesStorePayload([]);
    }
    throw error;
  }
}

async function saveLocalNotesStore(rootDir = process.cwd(), payload = null, stateKey = "owner") {
  const filePath = path.join(rootDir, buildLocalNotesPath(stateKey));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(normalizeNotesStorePayload(payload), null, 2)}\n`, "utf8");
}

async function loadPersistedNotes(rootDir = process.cwd(), stateKey = "owner") {
  const provider = getStorageProvider(rootDir, stateKey);

  if (provider === "firebase") {
    const docPath = validateFirestoreDocPath(resolveFirestoreNotesDocPath(rootDir, stateKey), "FIRESTORE_NOTES_DOC_PATH");
    const { ref, data } = await readFirestoreDoc(rootDir, docPath);
    if (data) {
      return normalizeNotesStorePayload(data).notes;
    }

    const emptyStore = normalizeNotesStorePayload([]);
    try {
      await ref.create(emptyStore);
      return emptyStore.notes;
    } catch (error) {
      if (!isFirestoreAlreadyExistsError(error)) {
        throw error;
      }

      const concurrent = await ref.get();
      return normalizeNotesStorePayload(concurrent.exists ? concurrent.data() : []).notes;
    }
  }

  if (provider === "local") {
    const localStore = await loadLocalNotesStore(rootDir, stateKey);
    return localStore.notes;
  }

  const persisted = await readJsonBlob(buildNotesBlobPath(stateKey));
  return normalizeNotesStorePayload(persisted?.data).notes;
}

async function savePersistedNotes(rootDir = process.cwd(), notes = [], stateKey = "owner", options = {}) {
  const mutationId = trimValue(options.mutationId);
  const provider = getStorageProvider(rootDir, stateKey);
  const normalizedNotes = Array.isArray(notes) ? notes : [];

  if (provider === "firebase") {
    const db = await getFirestoreDb(rootDir);
    const ref = db.doc(validateFirestoreDocPath(resolveFirestoreNotesDocPath(rootDir, stateKey), "FIRESTORE_NOTES_DOC_PATH"));
    let nextStore = null;

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const currentStore = normalizeNotesStorePayload(snapshot.exists ? snapshot.data() : []);

      if (mutationId && hasRecentMutationId(currentStore.metadata?.recentMutationIds, mutationId)) {
        nextStore = currentStore;
        return;
      }

      nextStore = buildNotesStorePayload(normalizedNotes, currentStore, mutationId);
      transaction.set(ref, nextStore);
    });

    return nextStore.notes;
  }

  if (provider === "local") {
    const currentStore = await loadLocalNotesStore(rootDir, stateKey);
    if (mutationId && hasRecentMutationId(currentStore.metadata?.recentMutationIds, mutationId)) {
      return currentStore.notes;
    }

    const nextStore = buildNotesStorePayload(normalizedNotes, currentStore, mutationId);
    await saveLocalNotesStore(rootDir, nextStore, stateKey);
    return nextStore.notes;
  }

  const currentStore = normalizeNotesStorePayload((await readJsonBlob(buildNotesBlobPath(stateKey)))?.data);
  if (mutationId && hasRecentMutationId(currentStore.metadata?.recentMutationIds, mutationId)) {
    return currentStore.notes;
  }

  const nextStore = buildNotesStorePayload(normalizedNotes, currentStore, mutationId);
  await writeJsonBlob(buildNotesBlobPath(stateKey), nextStore, { allowOverwrite: true });
  return nextStore.notes;
}

async function getStorageHealth(rootDir = process.cwd(), stateKey = "owner") {
  const provider = getStorageProvider(rootDir, stateKey);
  const health = {
    provider,
    stateKey,
    blobConfigured: hasBlobStorage(rootDir),
    firebaseConfigured: hasFirebaseStorage(rootDir, stateKey),
  };

  if (provider === "firebase") {
    health.portfolioDocPath = resolveFirestorePortfolioDocPath(rootDir, stateKey);
    health.notesDocPath = resolveFirestoreNotesDocPath(rootDir, stateKey);
  }

  try {
    const portfolio = await loadPersistedPortfolio(rootDir, null, stateKey);
    health.revision = getPortfolioRevision(portfolio);
  } catch (error) {
    health.error = error.message || "storage health unavailable";
  }

  return health;
}

module.exports = {
  hasBlobStorage,
  hasFirebaseStorage,
  loadPersistedNotes,
  loadPersistedPortfolio,
  savePersistedNotes,
  savePersistedPortfolio,
  buildNotesBlobPath,
  buildPortfolioBlobPath,
  getPortfolioBlobMeta,
  getPortfolioRevision,
  getStorageHealth,
  getStorageProvider,
};
