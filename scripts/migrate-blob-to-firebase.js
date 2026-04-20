#!/usr/bin/env node

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const { readLocalEnvFilesSync } = require("../lib/env-file");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  normalizeMultilineSecret,
  resolveFirebaseAppOptions,
  validateFirestoreDocPath: validateSharedFirestoreDocPath,
} = require("../lib/firebase-admin-config");
const {
  buildNotesBlobPath,
  buildPortfolioBlobPath,
  resolveFirestoreNotesDocPathFromEnv,
  resolveFirestorePortfolioDocPathFromEnv,
} = require("../lib/storage-manifest");

function printUsage() {
  console.log(`
Usage:
  node scripts/migrate-blob-to-firebase.js [options]

Options:
  --apply               Actually write Blob data into Firestore
  --force               Allow overwrite even when Firestore docs already exist
  --state <key>         Single stateKey to migrate (repeatable)
  --states a,b,c        Comma-separated stateKeys
  --backup-dir <dir>    Backup directory path (default: backups/storage-migration/<timestamp>)
  --no-backup           Skip local backup file creation (apply mode only)
  --help                Show this help

Notes:
  - Default mode is dry-run (no writes).
  - This script reads Blob as source-of-truth and can write to Firestore.
  - Run dry-run first, then run with --apply once validation looks good.
`);
}

function parseArgs(argv = []) {
  const options = {
    apply: false,
    force: false,
    states: [],
    backupDir: "",
    backup: true,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || "").trim();
    if (!arg) {
      continue;
    }

    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--force") {
      options.force = true;
      continue;
    }
    if (arg === "--no-backup") {
      options.backup = false;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--state") {
      const next = String(argv[index + 1] || "").trim();
      if (!next) {
        throw new Error("--state 다음에 stateKey를 입력하세요.");
      }
      options.states.push(next);
      index += 1;
      continue;
    }
    if (arg === "--states") {
      const next = String(argv[index + 1] || "").trim();
      if (!next) {
        throw new Error("--states 다음에 stateKey 목록을 입력하세요.");
      }
      next
        .split(",")
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .forEach((item) => options.states.push(item));
      index += 1;
      continue;
    }
    if (arg === "--backup-dir") {
      const next = String(argv[index + 1] || "").trim();
      if (!next) {
        throw new Error("--backup-dir 다음에 디렉터리 경로를 입력하세요.");
      }
      options.backupDir = next;
      index += 1;
      continue;
    }

    throw new Error(`알 수 없는 옵션: ${arg}`);
  }

  return options;
}

function readLocalEnv(rootDir = process.cwd()) {
  return readLocalEnvFilesSync(rootDir);
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

function validateFirestoreDocPath(docPath, label) {
  return validateSharedFirestoreDocPath(docPath, label, {
    emptyMessage: `${label} 값이 비어 있습니다.`,
    invalidShapeMessage: `${label}는 'collection/doc' 형태여야 합니다.`,
  });
}

async function loadBlobSdk() {
  return import("@vercel/blob");
}

function isBlobNotFoundError(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.name === "BlobNotFoundError" || message.includes("not found");
}

async function readJsonBlob(pathname = "") {
  const { get } = await loadBlobSdk();
  try {
    const result = await get(pathname, {
      access: "private",
      useCache: false,
    });
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

function toStableValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toStableValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce((result, key) => {
        result[key] = toStableValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function stableStringify(value) {
  return JSON.stringify(toStableValue(value));
}

function valuesEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
}

function formatTimestampForPath(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

async function writeBackupFile(filePath = "", value = null) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const body = `${JSON.stringify(value, null, 2)}\n`;
  await fsp.writeFile(filePath, body, "utf8");
}

function resolveStateKeys(options = {}, env = {}) {
  if (Array.isArray(options.states) && options.states.length) {
    return [...new Set(options.states.map((item) => String(item || "").trim()).filter(Boolean))];
  }

  const ownerStateKey = trimValue(env.OWNER_STATE_KEY) || "owner";
  return [ownerStateKey];
}

function assertRequiredEnv(env = {}, stateKeys = [], rootDir = process.cwd()) {
  if (!trimValue(env.BLOB_READ_WRITE_TOKEN)) {
    throw new Error("BLOB_READ_WRITE_TOKEN이 필요합니다.");
  }

  const hasPortfolioPath =
    trimValue(env.FIRESTORE_PORTFOLIO_DOC_PATH || env.FIRESTORE_PORTFOLIO_PATH) ||
    trimValue(env.FIRESTORE_PORTFOLIO_COLLECTION_PATH);
  const hasNotesPath = trimValue(env.FIRESTORE_NOTES_DOC_PATH) || trimValue(env.FIRESTORE_NOTES_COLLECTION_PATH);
  if (!hasPortfolioPath || !hasNotesPath) {
    throw new Error(
      "Firestore 경로가 필요합니다. FIRESTORE_PORTFOLIO_DOC_PATH/FIRESTORE_PORTFOLIO_COLLECTION_PATH 및 FIRESTORE_NOTES_DOC_PATH/FIRESTORE_NOTES_COLLECTION_PATH를 설정하세요."
    );
  }

  stateKeys.forEach((stateKey) => {
    validateFirestoreDocPath(resolveFirestorePortfolioDocPathFromEnv(env, stateKey), "FIRESTORE_PORTFOLIO_DOC_PATH");
    validateFirestoreDocPath(resolveFirestoreNotesDocPathFromEnv(env, stateKey), "FIRESTORE_NOTES_DOC_PATH");
  });

  const hasInlineServiceAccount = trimValue(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  const explicitServiceAccountFile = trimValue(env.FIREBASE_SERVICE_ACCOUNT_FILE);
  const hasFileServiceAccount = explicitServiceAccountFile
    ? fs.existsSync(path.resolve(rootDir, explicitServiceAccountFile))
    : fs.existsSync(path.join(rootDir, "config", "serviceAccountKey.json"));
  const hasSplitCredentials =
    trimValue(env.FIREBASE_PROJECT_ID || env.GCLOUD_PROJECT || env.GOOGLE_CLOUD_PROJECT) &&
    trimValue(env.FIREBASE_CLIENT_EMAIL) &&
    normalizeMultilineSecret(env.FIREBASE_PRIVATE_KEY);

  if (!hasInlineServiceAccount && !hasFileServiceAccount && !hasSplitCredentials) {
    throw new Error(
      "Firebase 인증정보가 필요합니다. FIREBASE_SERVICE_ACCOUNT_JSON 또는 FIREBASE_SERVICE_ACCOUNT_FILE 또는 FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY를 설정하세요."
    );
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const rootDir = path.resolve(__dirname, "..");
  const env = readRuntimeEnv(rootDir);
  if (!trimValue(process.env.BLOB_READ_WRITE_TOKEN) && trimValue(env.BLOB_READ_WRITE_TOKEN)) {
    process.env.BLOB_READ_WRITE_TOKEN = trimValue(env.BLOB_READ_WRITE_TOKEN);
  }
  const stateKeys = resolveStateKeys(options, env);
  if (!stateKeys.length) {
    throw new Error("마이그레이션할 stateKey가 없습니다.");
  }

  assertRequiredEnv(env, stateKeys, rootDir);

  const dryRun = !options.apply;
  const timestamp = formatTimestampForPath(new Date());
  const backupRoot = trimValue(options.backupDir)
    ? path.resolve(rootDir, options.backupDir)
    : path.join(rootDir, "backups", "storage-migration", timestamp);

  const appName = `asset-main-migration-${Date.now()}`;
  const app = initializeApp(resolveFirebaseAppOptions(env, rootDir), appName);
  const db = getFirestore(app);

  console.log(`[migration] mode=${dryRun ? "dry-run" : "apply"} force=${options.force ? "yes" : "no"} states=${stateKeys.join(",")}`);
  if (!dryRun && options.backup) {
    console.log(`[migration] backup-dir=${backupRoot}`);
  }

  const summary = [];

  for (const stateKey of stateKeys) {
    const portfolioBlobPath = buildPortfolioBlobPath(stateKey);
    const notesBlobPath = buildNotesBlobPath(stateKey);
    const portfolioDocPath = validateFirestoreDocPath(
      resolveFirestorePortfolioDocPathFromEnv(env, stateKey),
      "FIRESTORE_PORTFOLIO_DOC_PATH"
    );
    const notesDocPath = validateFirestoreDocPath(
      resolveFirestoreNotesDocPathFromEnv(env, stateKey),
      "FIRESTORE_NOTES_DOC_PATH"
    );
    const portfolioRef = db.doc(portfolioDocPath);
    const notesRef = db.doc(notesDocPath);

    const [blobPortfolio, blobNotes, firebasePortfolioSnap, firebaseNotesSnap] = await Promise.all([
      readJsonBlob(portfolioBlobPath),
      readJsonBlob(notesBlobPath),
      portfolioRef.get(),
      notesRef.get(),
    ]);

    const firebasePortfolio = firebasePortfolioSnap.exists ? firebasePortfolioSnap.data() : null;
    const firebaseNotes = firebaseNotesSnap.exists ? firebaseNotesSnap.data() : null;

    console.log(`\n[state:${stateKey}]`);
    console.log(`- blob portfolio: ${blobPortfolio ? "found" : "missing"} (${portfolioBlobPath})`);
    console.log(`- blob notes: ${blobNotes ? "found" : "missing"} (${notesBlobPath})`);
    console.log(`- firebase portfolio: ${firebasePortfolio ? "found" : "missing"} (${portfolioDocPath})`);
    console.log(`- firebase notes: ${firebaseNotes ? "found" : "missing"} (${notesDocPath})`);

    if (!blobPortfolio && !blobNotes) {
      console.log("- skip: Blob source data missing");
      summary.push({ stateKey, migrated: false, reason: "blob-missing" });
      continue;
    }

    if (!dryRun && !options.force && (firebasePortfolio || firebaseNotes)) {
      throw new Error(
        `[${stateKey}] Firestore 문서가 이미 존재합니다. 덮어쓰려면 --force를 사용하세요. (${portfolioDocPath}, ${notesDocPath})`
      );
    }

    if (!dryRun && options.backup) {
      const stateBackupDir = path.join(backupRoot, stateKey);
      await writeBackupFile(path.join(stateBackupDir, "blob.portfolio.json"), blobPortfolio);
      await writeBackupFile(path.join(stateBackupDir, "blob.notes.json"), blobNotes);
      await writeBackupFile(path.join(stateBackupDir, "firebase.before.portfolio.json"), firebasePortfolio);
      await writeBackupFile(path.join(stateBackupDir, "firebase.before.notes.json"), firebaseNotes);
    }

    if (dryRun) {
      const portfolioMatched = blobPortfolio ? valuesEqual(blobPortfolio, firebasePortfolio) : firebasePortfolio == null;
      const notesMatched = blobNotes ? valuesEqual(blobNotes, firebaseNotes) : firebaseNotes == null;
      const portfolioStatus = blobPortfolio ? (portfolioMatched ? "ok" : "would-update") : firebasePortfolio ? "would-delete" : "ok";
      const notesStatus = blobNotes ? (notesMatched ? "ok" : "would-update") : firebaseNotes ? "would-delete" : "ok";
      const dryReason = portfolioMatched && notesMatched ? "already-synced" : "dry-run-would-write";
      console.log(`- verify(dry-run): portfolio=${portfolioStatus}, notes=${notesStatus}`);
      summary.push({ stateKey, migrated: true, reason: dryReason });
      continue;
    }

    if (!dryRun) {
      const writes = [];
      if (blobPortfolio) {
        writes.push(portfolioRef.set(blobPortfolio));
      } else if (options.force && firebasePortfolio != null) {
        writes.push(portfolioRef.delete());
      }
      if (blobNotes) {
        writes.push(notesRef.set(blobNotes));
      } else if (options.force && firebaseNotes != null) {
        writes.push(notesRef.delete());
      }
      await Promise.all(writes);
    }

    const [firebasePortfolioAfterSnap, firebaseNotesAfterSnap] = await Promise.all([portfolioRef.get(), notesRef.get()]);
    const firebasePortfolioAfter = firebasePortfolioAfterSnap.exists ? firebasePortfolioAfterSnap.data() : null;
    const firebaseNotesAfter = firebaseNotesAfterSnap.exists ? firebaseNotesAfterSnap.data() : null;

    const portfolioMatched = blobPortfolio ? valuesEqual(blobPortfolio, firebasePortfolioAfter) : firebasePortfolioAfter == null;
    const notesMatched = blobNotes ? valuesEqual(blobNotes, firebaseNotesAfter) : firebaseNotesAfter == null;
    if (!portfolioMatched || !notesMatched) {
      throw new Error(`[${stateKey}] 검증 실패: Firestore 데이터가 Blob 원본과 다릅니다.`);
    }

    console.log(`- verify: portfolio=${portfolioMatched ? "ok" : "mismatch"}, notes=${notesMatched ? "ok" : "mismatch"}`);
    summary.push({ stateKey, migrated: true, reason: dryRun ? "dry-run-verified" : "applied-and-verified" });
  }

  console.log("\n[migration] summary");
  summary.forEach((item) => {
    console.log(`- ${item.stateKey}: ${item.migrated ? "ok" : "skip"} (${item.reason})`);
  });

  if (dryRun) {
    console.log("\n[migration] dry-run complete. Apply with: node scripts/migrate-blob-to-firebase.js --apply");
  } else {
    console.log("\n[migration] apply complete. Next: set Vercel STORAGE_PROVIDER=firebase and redeploy.");
  }
}

run().catch((error) => {
  console.error(`\n[migration] failed: ${error.message || error}`);
  process.exitCode = 1;
});
