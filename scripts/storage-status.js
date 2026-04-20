#!/usr/bin/env node

const path = require("path");

const { getStorageHealth } = require("../lib/server-state-store");

function formatPresence(exists) {
  return exists ? "present" : "missing";
}

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const stateKey = String(args.find((arg) => !arg.startsWith("--")) || "owner").trim() || "owner";
  const rootDir = path.resolve(__dirname, "..");
  const health = await getStorageHealth(rootDir, stateKey);

  if (jsonMode) {
    console.log(JSON.stringify(health, null, 2));
    return;
  }

  console.log(`provider: ${health.provider}`);
  console.log(`explicitProvider: ${health.explicitProvider || "-"}`);
  console.log(`stateKey: ${health.stateKey}`);
  console.log(`runtimeTargetKind: ${health.runtimeTargetKind}`);
  console.log(`runtimePortfolioTarget: ${health.runtimePortfolioTarget || "-"}`);
  console.log(`runtimeNotesTarget: ${health.runtimeNotesTarget || "-"}`);
  console.log(`bundledPortfolioPath: ${health.bundledPortfolioPath} (${formatPresence(health.bundledPortfolioExists)})`);
  console.log(`localPortfolioPath: ${health.localPortfolioPath} (${formatPresence(health.localPortfolioExists)})`);
  console.log(`localNotesPath: ${health.localNotesPath} (${formatPresence(health.localNotesExists)})`);
  if (Number.isFinite(Number(health.revision))) {
    console.log(`revision: ${health.revision}`);
  }
  if (health.error) {
    console.log(`loadError: ${health.error}`);
  }
  if (Array.isArray(health.warnings) && health.warnings.length) {
    health.warnings.forEach((warning) => {
      console.log(`warning: ${warning.code} - ${warning.message}`);
    });
  }

  console.log("");
  if (health.provider === "local" && health.stateKey === "owner") {
    console.log("This workspace is writing live owner state back into the local data files.");
    return;
  }

  console.log(`This workspace reads and writes live state through ${health.runtimeTargetKind}.`);
  console.log(`${health.bundledPortfolioPath} remains the repo fallback/access-profile file, not the live owner timeline.`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
