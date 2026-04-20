const fs = require("fs");
const path = require("path");
const { applicationDefault, cert } = require("firebase-admin/app");

function trimValue(value = "") {
  return String(value || "").trim();
}

function trimFirestorePath(value = "") {
  return trimValue(value).replace(/^\/+|\/+$/g, "");
}

function normalizeMultilineSecret(value = "") {
  return String(value || "").replace(/\\n/g, "\n").trim();
}

function parseInlineServiceAccountJson(value = "") {
  const raw = trimValue(value);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (_error) {
    const normalized = raw.replace(/\\n(?=[ \t}])/g, "\n").replace(/\\n\s*$/, "");
    return JSON.parse(normalized);
  }
}

function validateFirestoreDocPath(docPath, label, options = {}) {
  const normalized = trimFirestorePath(docPath);
  const emptyMessage = options.emptyMessage || `${label} 값이 비어 있습니다.`;
  const invalidShapeMessage = options.invalidShapeMessage || `${label}는 'collection/doc' 형태여야 합니다.`;

  if (!normalized) {
    throw new Error(emptyMessage);
  }

  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length || segments.length % 2 !== 0) {
    throw new Error(invalidShapeMessage);
  }

  return normalized;
}

function resolveServiceAccountObject(env = {}, rootDir = process.cwd()) {
  const inlineJson = trimValue(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (inlineJson) {
    const parsed = parseInlineServiceAccountJson(inlineJson);
    return {
      ...parsed,
      private_key: normalizeMultilineSecret(parsed.private_key || parsed.privateKey || ""),
    };
  }

  const explicitFile = trimValue(env.FIREBASE_SERVICE_ACCOUNT_FILE);
  const defaultFile = path.join(rootDir, "config", "serviceAccountKey.json");
  const serviceAccountPath = explicitFile ? path.resolve(rootDir, explicitFile) : defaultFile;
  if (fs.existsSync(serviceAccountPath)) {
    const parsed = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
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

function resolveFirebaseAppOptions(env = {}, rootDir = process.cwd()) {
  const serviceAccount = resolveServiceAccountObject(env, rootDir);
  const projectId = trimValue(
    env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT || serviceAccount?.project_id
  );

  return {
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
    ...(projectId ? { projectId } : {}),
  };
}

module.exports = {
  normalizeMultilineSecret,
  parseInlineServiceAccountJson,
  resolveFirebaseAppOptions,
  resolveServiceAccountObject,
  trimFirestorePath,
  trimValue,
  validateFirestoreDocPath,
};
