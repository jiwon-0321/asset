const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");

const DEFAULT_ENV_FILES = Object.freeze([".env.local", ".env"]);

function isClosedQuotedValue(value = "", quote = '"') {
  const text = String(value || "");
  if (!text.startsWith(quote)) {
    return true;
  }
  if (text.length <= 1 || !text.endsWith(quote)) {
    return false;
  }

  let trailingBackslashes = 0;
  for (let index = text.length - 2; index >= 0 && text[index] === "\\"; index -= 1) {
    trailingBackslashes += 1;
  }

  return trailingBackslashes % 2 === 0;
}

function unquoteValue(rawValue = "") {
  const text = String(rawValue || "");
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return text.slice(1, -1);
  }
  return text;
}

function parseEnvContent(content = "") {
  const env = {};
  const lines = String(content || "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key) {
      continue;
    }

    let rawValue = trimmed.slice(separator + 1).trim();
    const quote = rawValue.startsWith('"') || rawValue.startsWith("'") ? rawValue[0] : "";
    if (quote && !isClosedQuotedValue(rawValue, quote)) {
      const parts = [rawValue];
      while (index + 1 < lines.length) {
        index += 1;
        const nextLine = String(lines[index] || "");
        parts.push(nextLine);
        if (isClosedQuotedValue(nextLine, quote)) {
          break;
        }
      }
      rawValue = parts.join("\n");
    }

    env[key] = unquoteValue(rawValue);
  }

  return env;
}

function readLocalEnvFilesSync(rootDir = process.cwd(), fileNames = DEFAULT_ENV_FILES) {
  const merged = {};
  for (const fileName of fileNames) {
    const filePath = path.join(rootDir, fileName);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      Object.assign(merged, parseEnvContent(content));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return merged;
}

async function readLocalEnvFiles(rootDir = process.cwd(), fileNames = DEFAULT_ENV_FILES) {
  const merged = {};
  for (const fileName of fileNames) {
    const filePath = path.join(rootDir, fileName);
    try {
      const content = await fsPromises.readFile(filePath, "utf8");
      Object.assign(merged, parseEnvContent(content));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }
  return merged;
}

module.exports = {
  parseEnvContent,
  readLocalEnvFiles,
  readLocalEnvFilesSync,
};
