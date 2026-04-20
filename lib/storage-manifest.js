const path = require("path");

function trimValue(value = "") {
  return String(value || "").trim();
}

function trimFirestorePath(value = "") {
  return trimValue(value).replace(/^\/+|\/+$/g, "");
}

function buildPortfolioBlobPath(stateKey = "owner") {
  return `app-state/${stateKey}/portfolio.json`;
}

function buildNotesBlobPath(stateKey = "owner") {
  return `app-state/${stateKey}/notes.json`;
}

function buildLocalPortfolioPath(stateKey = "owner") {
  return stateKey === "owner" ? path.join("data", "portfolio.local.json") : path.join("data", `portfolio.${stateKey}.json`);
}

function buildBundledPortfolioPath() {
  return path.join("data", "portfolio-sample.json");
}

function buildLocalNotesPath(stateKey = "owner") {
  return stateKey === "owner" ? path.join("data", "notes.json") : path.join("data", `notes.${stateKey}.json`);
}

function resolveFirestorePortfolioDocPathFromEnv(env = {}, stateKey = "owner") {
  const explicitPath = trimFirestorePath(env.FIRESTORE_PORTFOLIO_DOC_PATH || env.FIRESTORE_PORTFOLIO_PATH);
  if (explicitPath) {
    return explicitPath;
  }

  const collectionPath = trimFirestorePath(env.FIRESTORE_PORTFOLIO_COLLECTION_PATH);
  return collectionPath ? `${collectionPath}/${stateKey}` : "";
}

function resolveFirestoreNotesDocPathFromEnv(env = {}, stateKey = "owner") {
  const explicitPath = trimFirestorePath(env.FIRESTORE_NOTES_DOC_PATH);
  if (explicitPath) {
    return explicitPath;
  }

  const collectionPath = trimFirestorePath(env.FIRESTORE_NOTES_COLLECTION_PATH);
  return collectionPath ? `${collectionPath}/${stateKey}` : "";
}

function hasFirebaseStorageFromEnv(env = {}, stateKey = "owner") {
  return Boolean(resolveFirestorePortfolioDocPathFromEnv(env, stateKey));
}

function resolveExplicitStorageProviderFromEnv(env = {}) {
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
  return "";
}

function resolveStorageProviderFromEnv(
  env = {},
  { stateKey = "owner", blobConfigured = false, firebaseConfigured = hasFirebaseStorageFromEnv(env, stateKey) } = {}
) {
  const explicitProvider = resolveExplicitStorageProviderFromEnv(env);
  if (explicitProvider) {
    return explicitProvider;
  }
  if (firebaseConfigured) {
    return "firebase";
  }
  return blobConfigured ? "blob" : "local";
}

function getRuntimeStorageTargetsFromEnv(
  env = {},
  {
    stateKey = "owner",
    provider = "",
    blobConfigured = false,
    firebaseConfigured = hasFirebaseStorageFromEnv(env, stateKey),
  } = {}
) {
  const resolvedProvider =
    provider || resolveStorageProviderFromEnv(env, { stateKey, blobConfigured, firebaseConfigured });
  if (resolvedProvider === "firebase") {
    return {
      runtimeTargetKind: "firestore-doc",
      runtimePortfolioTarget: resolveFirestorePortfolioDocPathFromEnv(env, stateKey),
      runtimeNotesTarget: resolveFirestoreNotesDocPathFromEnv(env, stateKey),
    };
  }

  if (resolvedProvider === "blob") {
    return {
      runtimeTargetKind: "blob-path",
      runtimePortfolioTarget: buildPortfolioBlobPath(stateKey),
      runtimeNotesTarget: buildNotesBlobPath(stateKey),
    };
  }

  return {
    runtimeTargetKind: "local-file",
    runtimePortfolioTarget: buildLocalPortfolioPath(stateKey),
    runtimeNotesTarget: buildLocalNotesPath(stateKey),
  };
}

function getStorageConfigurationWarningsFromEnv(
  env = {},
  {
    stateKey = "owner",
    explicitProvider = resolveExplicitStorageProviderFromEnv(env),
    provider = "",
    blobConfigured = false,
    firebaseConfigured = hasFirebaseStorageFromEnv(env, stateKey),
  } = {}
) {
  const resolvedProvider =
    provider || resolveStorageProviderFromEnv(env, { stateKey, blobConfigured, firebaseConfigured });
  const warnings = [];

  if (explicitProvider === "blob" && firebaseConfigured) {
    warnings.push({
      code: "firebase-configured-but-explicit-blob-provider",
      message: "Firebase is configured, but STORAGE_PROVIDER is explicitly forcing Blob writes.",
    });
  }

  if (!explicitProvider && resolvedProvider === "blob" && firebaseConfigured && blobConfigured) {
    warnings.push({
      code: "firebase-configured-but-provider-fell-back-to-blob",
      message: "Firebase is configured, but runtime storage still resolved to Blob.",
    });
  }

  return warnings;
}

module.exports = {
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
  trimFirestorePath,
  trimValue,
};
