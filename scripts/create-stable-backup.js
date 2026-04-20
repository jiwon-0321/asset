#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const BACKUP_ROOT = path.join(ROOT, "backups", "stable");
const KEEP_COUNT = 5;
const DIRECTORY_EXCLUDES = new Set([".git", "node_modules", ".vercel", "backups"]);
const FILE_EXCLUDES = new Set([".DS_Store"]);

function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function readGitValue(args = []) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch (error) {
    return "";
  }
}

async function copyDirectory(sourceDir, destinationDir, state) {
  await fs.mkdir(destinationDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (FILE_EXCLUDES.has(entry.name)) {
      continue;
    }

    if (entry.isDirectory() && DIRECTORY_EXCLUDES.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath, state);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
    state.fileCount += 1;
  }
}

async function pruneOldSnapshots() {
  const entries = await fs.readdir(BACKUP_ROOT, { withFileTypes: true }).catch(() => []);
  const snapshotDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("snapshot-"))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const staleDirs = snapshotDirs.slice(KEEP_COUNT);
  await Promise.all(
    staleDirs.map((dirName) => fs.rm(path.join(BACKUP_ROOT, dirName), { recursive: true, force: true }))
  );
}

async function main() {
  const timestamp = buildTimestamp();
  const snapshotDir = path.join(BACKUP_ROOT, `snapshot-${timestamp}`);
  const state = { fileCount: 0 };

  await fs.mkdir(BACKUP_ROOT, { recursive: true });
  await copyDirectory(ROOT, snapshotDir, state);

  const manifest = {
    createdAt: new Date().toISOString(),
    sourceRoot: ROOT,
    fileCount: state.fileCount,
    gitBranch: readGitValue(["branch", "--show-current"]),
    gitCommit: readGitValue(["rev-parse", "HEAD"]),
  };

  await fs.writeFile(path.join(snapshotDir, "backup-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await pruneOldSnapshots();

  process.stdout.write(`${snapshotDir}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
