const fsSync = require("fs");
const path = require("path");
const fs = require("fs/promises");
const { getApp, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { readLocalEnvFilesSync } = require("./env-file");
const {
  resolveFirebaseAppOptions: resolveSharedFirebaseAppOptions,
  validateFirestoreDocPath: validateSharedFirestoreDocPath,
} = require("./firebase-admin-config");
const {
  buildBundledPortfolioPath,
  buildLocalNotesPath,
  buildLocalPortfolioPath,
  buildNotesBlobPath,
  buildPortfolioBlobPath,
  getRuntimeStorageTargetsFromEnv,
  getStorageConfigurationWarningsFromEnv,
  hasFirebaseStorageFromEnv,
  resolveExplicitStorageProviderFromEnv,
  resolveFirestoreNotesDocPathFromEnv,
  resolveFirestorePortfolioDocPathFromEnv,
  resolveStorageProviderFromEnv,
} = require("./storage-manifest");

const { loadPortfolio, savePortfolio } = require("../scripts/portfolio-store");

const PORTFOLIO_BLOB_META = Symbol("portfolio-blob-meta");
const FIREBASE_APP_NAME = "asset-main-storage";
const MUTATION_LOG_LIMIT = 60;
const PORTFOLIO_BLOB_BACKUP_LIMIT = 24;
const STALE_WRITE_ERROR = "다른 변경이 먼저 저장되었습니다. 화면을 새로고침한 뒤 다시 시도해주세요.";

let localEnvCache = null;
let firestoreCache = null;

function readLocalEnv(rootDir = process.cwd()) {
  const cacheKey = path.resolve(rootDir);
  if (localEnvCache?.key === cacheKey) {
    return localEnvCache.value;
  }

  const merged = readLocalEnvFilesSync(cacheKey);

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

function buildPortfolioBlobBackupPrefix(stateKey = "owner") {
  return `app-state/${stateKey}/history/`;
}

function buildPortfolioBlobBackupPath(stateKey = "owner", revision = 0) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const revisionLabel = Number.isFinite(Number(revision)) && Number(revision) > 0 ? `-r${Number(revision)}` : "";
  return `${buildPortfolioBlobBackupPrefix(stateKey)}portfolio-${timestamp}${revisionLabel}.json`;
}

function hasRelativeFile(rootDir = process.cwd(), relativePath = "") {
  const normalized = String(relativePath || "").trim();
  return Boolean(normalized) && fsSync.existsSync(path.join(rootDir, normalized));
}

function getRuntimeStorageTargets(rootDir = process.cwd(), stateKey = "owner", provider = getStorageProvider(rootDir, stateKey)) {
  const env = readRuntimeEnv(rootDir);
  const blobConfigured = hasBlobStorage(rootDir);
  const firebaseConfigured = hasFirebaseStorageFromEnv(env, stateKey);
  return getRuntimeStorageTargetsFromEnv(env, {
    stateKey,
    provider,
    blobConfigured,
    firebaseConfigured,
  });
}

async function loadLocalPortfolioState(rootDir = process.cwd(), stateKey = "owner") {
  if (stateKey === "owner") {
    return loadPortfolio(rootDir);
  }

  const filePath = path.join(rootDir, buildLocalPortfolioPath(stateKey));
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function saveLocalPortfolioState(rootDir = process.cwd(), portfolio, stateKey = "owner") {
  if (stateKey === "owner") {
    await savePortfolio(rootDir, portfolio);
    return;
  }

  const filePath = path.join(rootDir, buildLocalPortfolioPath(stateKey));
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(portfolio, null, 2)}\n`, "utf8");
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
  return resolveFirestorePortfolioDocPathFromEnv(readRuntimeEnv(rootDir), stateKey);
}

function resolveFirestoreNotesDocPath(rootDir = process.cwd(), stateKey = "owner") {
  return resolveFirestoreNotesDocPathFromEnv(readRuntimeEnv(rootDir), stateKey);
}

function hasFirebaseStorage(rootDir = process.cwd(), stateKey = "owner") {
  return hasFirebaseStorageFromEnv(readRuntimeEnv(rootDir), stateKey);
}

function getExplicitStorageProvider(rootDir = process.cwd()) {
  return resolveExplicitStorageProviderFromEnv(readRuntimeEnv(rootDir));
}

function getStorageProvider(rootDir = process.cwd(), stateKey = "owner") {
  const env = readRuntimeEnv(rootDir);
  return resolveStorageProviderFromEnv(env, {
    stateKey,
    blobConfigured: hasBlobStorage(rootDir),
    firebaseConfigured: hasFirebaseStorageFromEnv(env, stateKey),
  });
}

function getStorageConfigurationWarnings(rootDir = process.cwd(), stateKey = "owner", options = {}) {
  const env = readRuntimeEnv(rootDir);
  return getStorageConfigurationWarningsFromEnv(env, {
    stateKey,
    explicitProvider: options.explicitProvider || resolveExplicitStorageProviderFromEnv(env),
    provider: options.provider || getStorageProvider(rootDir, stateKey),
    firebaseConfigured: options.firebaseConfigured ?? hasFirebaseStorageFromEnv(env, stateKey),
    blobConfigured: options.blobConfigured ?? hasBlobStorage(rootDir),
  });
}

function validateFirestoreDocPath(docPath, label) {
  return validateSharedFirestoreDocPath(docPath, label, {
    emptyMessage: `${label} 환경변수가 비어 있습니다.`,
    invalidShapeMessage: `${label}는 'collection/doc' 형태의 Firestore 문서 경로여야 합니다.`,
  });
}

function isFirestoreAlreadyExistsError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === 6 || message.includes("already exists");
}

function resolveFirebaseAppOptions(rootDir = process.cwd()) {
  return resolveSharedFirebaseAppOptions(readRuntimeEnv(rootDir), rootDir);
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

async function loadBlobSdk(rootDir = process.cwd()) {
  ensureBlobToken(rootDir);
  return import("@vercel/blob");
}

async function createPortfolioBlobBackup(rootDir = process.cwd(), stateKey = "owner", pathname = "", options = {}) {
  const sourcePath = String(pathname || "").replace(/^\/+/, "");
  if (!sourcePath) {
    return null;
  }

  const { copy, del, list } = await loadBlobSdk(rootDir);
  const backupPath = buildPortfolioBlobBackupPath(stateKey, options.revision);
  const copyOptions = {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: false,
  };

  if (trimValue(options.ifMatch)) {
    copyOptions.ifMatch = trimValue(options.ifMatch);
  }

  const copiedBlob = await copy(sourcePath, backupPath, copyOptions);

  try {
    const listed = await list({
      prefix: buildPortfolioBlobBackupPrefix(stateKey),
      limit: PORTFOLIO_BLOB_BACKUP_LIMIT + 20,
    });
    const staleBlobs = [...(listed.blobs || [])]
      .sort((left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime())
      .slice(PORTFOLIO_BLOB_BACKUP_LIMIT);

    if (staleBlobs.length) {
      await del(staleBlobs.map((blob) => blob.pathname));
    }
  } catch (error) {
    // Backups are best-effort. Save flow should continue even if pruning fails.
  }

  return copiedBlob;
}

async function backupPortfolioBlobBeforeOverwrite(rootDir = process.cwd(), stateKey = "owner", pathname = "", options = {}) {
  const sourcePath = String(pathname || "").replace(/^\/+/, "");
  if (!sourcePath) {
    return null;
  }

  try {
    return await createPortfolioBlobBackup(rootDir, stateKey, sourcePath, options);
  } catch (error) {
    // Keep persistence writes available even when snapshotting fails.
    return null;
  }
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

async function readJsonBlob(pathname, rootDir = process.cwd()) {
  const { get } = await loadBlobSdk(rootDir);

  try {
    const result = await get(pathname, {
      access: "private",
      // Mutable app state must bypass private-blob cache so we compare/write against the latest ETag.
      useCache: false,
    });
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

async function writeJsonBlob(pathname, payload, options = {}, rootDir = process.cwd()) {
  const { put } = await loadBlobSdk(rootDir);
  const body = `${JSON.stringify(payload, null, 2)}\n`;

  return put(pathname, body, {
    access: "private",
    allowOverwrite: Boolean(options.allowOverwrite || options.ifMatch),
    addRandomSuffix: false,
    contentType: "application/json; charset=utf-8",
    ifMatch: options.ifMatch || undefined,
  });
}

async function saveBlobStateWithRetry(rootDir = process.cwd(), options = {}) {
  const pathname = String(options.pathname || "").replace(/^\/+/, "");
  if (!pathname) {
    throw new Error("Blob 저장 경로가 비어 있습니다.");
  }

  const initialPayload = options.payload;
  const initialEtag = trimValue(options.expectedEtag);
  const initialAllowOverwrite = options.allowOverwrite !== false;
  const beforeWrite = typeof options.beforeWrite === "function" ? options.beforeWrite : null;
  const onPreconditionFailed = typeof options.onPreconditionFailed === "function" ? options.onPreconditionFailed : null;

  const writeAttempt = async (attempt = {}) => {
    if (Object.prototype.hasOwnProperty.call(attempt, "result")) {
      return attempt.result;
    }

    const nextPayload = Object.prototype.hasOwnProperty.call(attempt, "payload") ? attempt.payload : initialPayload;
    const ifMatch = trimValue(
      Object.prototype.hasOwnProperty.call(attempt, "ifMatch") ? attempt.ifMatch : initialEtag
    );
    const allowOverwrite = Object.prototype.hasOwnProperty.call(attempt, "allowOverwrite")
      ? Boolean(attempt.allowOverwrite)
      : initialAllowOverwrite;
    const nextBeforeWrite =
      typeof attempt.beforeWrite === "function"
        ? attempt.beforeWrite
        : Object.prototype.hasOwnProperty.call(attempt, "beforeWrite")
          ? null
          : beforeWrite;

    if (nextBeforeWrite) {
      await nextBeforeWrite({
        pathname,
        payload: nextPayload,
        ifMatch,
      });
    }

    const blob = await writeJsonBlob(
      pathname,
      nextPayload,
      {
        allowOverwrite,
        ifMatch: ifMatch || undefined,
      },
      rootDir
    );

    return {
      payload: nextPayload,
      blob,
      pathname,
    };
  };

  try {
    return await writeAttempt();
  } catch (error) {
    if (!isBlobPreconditionFailedError(error) || !onPreconditionFailed) {
      throw error;
    }

    const recoveryAttempt = await onPreconditionFailed({
      error,
      pathname,
      expectedEtag: initialEtag,
    });

    const hasRecoveryPayload = recoveryAttempt && Object.prototype.hasOwnProperty.call(recoveryAttempt, "payload");
    const hasRecoveryResult = recoveryAttempt && Object.prototype.hasOwnProperty.call(recoveryAttempt, "result");
    if (!hasRecoveryPayload && !hasRecoveryResult) {
      throw error;
    }

    return writeAttempt(recoveryAttempt);
  }
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

async function loadPersistedPortfolio(rootDir = process.cwd(), fallbackPortfolio = null, stateKey = "owner", options = {}) {
  const seedIfMissing = options.seedIfMissing !== false;
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

    if (!seedIfMissing) {
      return null;
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
    try {
      const localPortfolio = await loadLocalPortfolioState(rootDir, stateKey);
      return withPortfolioRevision(localPortfolio, getPortfolioRevision(localPortfolio) || 1);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    if (!seedIfMissing) {
      return null;
    }

    const localFallback =
      stateKey !== "owner"
        ? fallbackPortfolio
          ? structuredClone(fallbackPortfolio)
          : {}
        : fallbackPortfolio
          ? structuredClone(fallbackPortfolio)
          : await loadPortfolio(rootDir);
    return withPortfolioRevision(localFallback, getPortfolioRevision(localFallback) || 1);
  }

  const blobPath = buildPortfolioBlobPath(stateKey);
  const persisted = await readJsonBlob(blobPath, rootDir);
  if (persisted?.data) {
    const portfolio = withPortfolioRevision(persisted.data, getPortfolioRevision(persisted.data) || 1);
    return attachPortfolioBlobMeta(portfolio, { etag: persisted.etag, pathname: blobPath });
  }

  if (!seedIfMissing) {
    return null;
  }

  const seeded = fallbackPortfolio ? structuredClone(fallbackPortfolio) : await loadPortfolio(rootDir);
  const initialPortfolio = withPortfolioRevision(seeded, getPortfolioRevision(seeded) || 1);
  try {
    const blob = await writeJsonBlob(blobPath, initialPortfolio, {}, rootDir);
    return attachPortfolioBlobMeta(initialPortfolio, { etag: blob?.etag || "", pathname: blobPath });
  } catch (error) {
    if (!isBlobAlreadyExistsError(error)) {
      throw error;
    }

    const concurrentPersisted = await readJsonBlob(blobPath, rootDir);
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
    await saveLocalPortfolioState(rootDir, nextPortfolio, stateKey);
    return nextPortfolio;
  }

  const latestPortfolio = mutationId ? await loadPersistedPortfolio(rootDir, null, stateKey) : null;
  if (mutationId && hasPortfolioMutationId(latestPortfolio, mutationId)) {
    return latestPortfolio;
  }

  const baseRevision = Math.max(expectedRevision ?? getPortfolioRevision(portfolio), 0);
  const nextPortfolio = recordPortfolioMutation(withPortfolioRevision(portfolio, baseRevision + 1), mutationId);
  const blobPath = buildPortfolioBlobPath(stateKey);

  const saved = await saveBlobStateWithRetry(rootDir, {
    pathname: blobPath,
    payload: nextPortfolio,
    expectedEtag,
    allowOverwrite: true,
    beforeWrite: async ({ ifMatch }) => {
      await backupPortfolioBlobBeforeOverwrite(rootDir, stateKey, blobPath, {
        ifMatch,
        revision: expectedRevision ?? getPortfolioRevision(portfolio),
      });
    },
    onPreconditionFailed: async () => {
      const currentPortfolio = await loadPersistedPortfolio(rootDir, null, stateKey);
      if (mutationId && hasPortfolioMutationId(currentPortfolio, mutationId)) {
        return { result: currentPortfolio };
      }

      const currentRevision = getPortfolioRevision(currentPortfolio);
      if (expectedRevision != null && currentRevision !== expectedRevision) {
        throw new Error(STALE_WRITE_ERROR);
      }

      const recoveredRevision = Math.max(currentRevision, expectedRevision ?? getPortfolioRevision(portfolio), 0) + 1;
      const recoveredPortfolio = recordPortfolioMutation(withPortfolioRevision(portfolio, recoveredRevision), mutationId);
      const currentBlobMeta = getPortfolioBlobMeta(currentPortfolio);
      return {
        payload: recoveredPortfolio,
        ifMatch: currentBlobMeta?.etag || "",
        beforeWrite: async () => {
          await backupPortfolioBlobBeforeOverwrite(
            rootDir,
            stateKey,
            currentBlobMeta?.pathname || blobPath,
            {
              ifMatch: currentBlobMeta?.etag || "",
              revision: currentRevision,
            }
          );
        },
        allowOverwrite: true,
      };
    },
  });

  if (!saved || !saved.blob) {
    return saved;
  }

  return attachPortfolioBlobMeta(saved.payload, {
    etag: saved.blob?.etag || "",
    pathname: blobPath,
  });
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

  const persisted = await readJsonBlob(buildNotesBlobPath(stateKey), rootDir);
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

  const notesPath = buildNotesBlobPath(stateKey);
  const currentPersisted = await readJsonBlob(notesPath, rootDir);
  const currentStore = normalizeNotesStorePayload(currentPersisted?.data);
  if (mutationId && hasRecentMutationId(currentStore.metadata?.recentMutationIds, mutationId)) {
    return currentStore.notes;
  }

  const nextStore = buildNotesStorePayload(normalizedNotes, currentStore, mutationId);
  const saved = await saveBlobStateWithRetry(rootDir, {
    pathname: notesPath,
    payload: nextStore,
    expectedEtag: currentPersisted?.etag || "",
    allowOverwrite: Boolean(currentPersisted?.etag),
    onPreconditionFailed: async () => {
      const concurrentPersisted = await readJsonBlob(notesPath, rootDir);
      const concurrentStore = normalizeNotesStorePayload(concurrentPersisted?.data);
      if (mutationId && hasRecentMutationId(concurrentStore.metadata?.recentMutationIds, mutationId)) {
        return {
          result: {
            payload: concurrentStore,
            blob: concurrentPersisted ? { etag: concurrentPersisted.etag || "" } : null,
            pathname: notesPath,
          },
        };
      }

      throw new Error(STALE_WRITE_ERROR);
    },
  });
  return normalizeNotesStorePayload(saved.payload).notes;
}

async function getStorageHealth(rootDir = process.cwd(), stateKey = "owner") {
  const provider = getStorageProvider(rootDir, stateKey);
  const explicitProvider = getExplicitStorageProvider(rootDir);
  const blobConfigured = hasBlobStorage(rootDir);
  const firebaseConfigured = hasFirebaseStorage(rootDir, stateKey);
  const localPortfolioPath = buildLocalPortfolioPath(stateKey);
  const localNotesPath = buildLocalNotesPath(stateKey);
  const bundledPortfolioPath = buildBundledPortfolioPath();
  const runtimeTargets = getRuntimeStorageTargets(rootDir, stateKey, provider);
  const health = {
    provider,
    explicitProvider: explicitProvider || null,
    stateKey,
    blobConfigured,
    firebaseConfigured,
    bundledPortfolioPath,
    bundledPortfolioExists: hasRelativeFile(rootDir, bundledPortfolioPath),
    bundledPortfolioUsage:
      provider === "local" && stateKey === "owner"
        ? "local-runtime-and-bundled-access-profile"
        : "bundled-access-profile-and-runtime-fallback",
    localPortfolioPath,
    localPortfolioExists: hasRelativeFile(rootDir, localPortfolioPath),
    localNotesPath,
    localNotesExists: hasRelativeFile(rootDir, localNotesPath),
    runtimeTargetKind: runtimeTargets.runtimeTargetKind,
    runtimePortfolioTarget: runtimeTargets.runtimePortfolioTarget,
    runtimeNotesTarget: runtimeTargets.runtimeNotesTarget,
    warnings: getStorageConfigurationWarnings(rootDir, stateKey, {
      explicitProvider,
      provider,
      blobConfigured,
      firebaseConfigured,
    }),
  };

  if (provider === "firebase") {
    health.portfolioDocPath = resolveFirestorePortfolioDocPath(rootDir, stateKey);
    health.notesDocPath = resolveFirestoreNotesDocPath(rootDir, stateKey);
  }

  try {
    const portfolio = await loadPersistedPortfolio(rootDir, null, stateKey, { seedIfMissing: false });
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
  buildLocalPortfolioPath,
  buildLocalNotesPath,
  getPortfolioBlobMeta,
  getPortfolioRevision,
  getExplicitStorageProvider,
  getStorageHealth,
  getStorageConfigurationWarnings,
  getStorageProvider,
  getRuntimeStorageTargets,
};
