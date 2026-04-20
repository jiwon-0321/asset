#!/usr/bin/env node

const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");
const { readLocalEnvFilesSync } = require("../lib/env-file");

const apiAccessHandler = require("../api/access");
const apiAssetChartHandler = require("../api/asset-chart");
const apiAssetSearchHandler = require("../api/asset-search");
const apiInitialSetupHandler = require("../api/initial-setup");
const apiLivePricesHandler = require("../api/live-prices");
const apiNotesHandler = require("../api/notes");
const apiPortfolioHandler = require("../api/portfolio");
const apiStrategyBudgetsHandler = require("../api/strategy-budgets");
const apiTargetsHandler = require("../api/targets");
const apiTradesHandler = require("../api/trades");
const apiUiPreferencesHandler = require("../api/ui-preferences");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, "..");
const LOCAL_ENV_FILES = [".env.local", ".env"];
const ALLOWED_ORIGINS = new Set([
  `http://${HOST}:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`,
]);
let localEnvCache = null;

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const API_ROUTE_HANDLERS = new Map([
  ["/api/access", apiAccessHandler],
  ["/api/asset-chart", apiAssetChartHandler],
  ["/api/asset-search", apiAssetSearchHandler],
  ["/api/cash-positions", apiPortfolioHandler],
  ["/api/initial-setup", apiInitialSetupHandler],
  ["/api/live-prices", apiLivePricesHandler],
  ["/api/notes", apiNotesHandler],
  ["/api/portfolio", apiPortfolioHandler],
  ["/api/storage-health", apiPortfolioHandler],
  ["/api/strategy-budgets", apiStrategyBudgetsHandler],
  ["/api/targets", apiTargetsHandler],
  ["/api/trade-photo-assist", apiTradesHandler],
  ["/api/trades", apiTradesHandler],
  ["/api/ui-preferences", apiUiPreferencesHandler],
]);

const API_ROUTE_REWRITES = new Map([
  ["/api/cash-positions", "/api/portfolio"],
  ["/api/storage-health", "/api/portfolio?storageHealth=1"],
  ["/api/trade-photo-assist", "/api/trades?photoAssist=1"],
]);

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function setCommonHeaders(response, requestOrigin = "") {
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Access-Code, X-Mutation-Id");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, payload, requestOrigin = "") {
  setCommonHeaders(response, requestOrigin);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, contentType, body, requestOrigin = "") {
  setCommonHeaders(response, requestOrigin);
  response.writeHead(statusCode, {
    "Content-Type": contentType,
  });
  response.end(body);
}

function resolvePublicPath(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath === "/" ? "/index.html" : requestPath);
  const absolutePath = path.resolve(ROOT, `.${normalizedPath}`);
  const relativePath = path.relative(ROOT, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }

  return absolutePath;
}

function readLocalEnv() {
  if (localEnvCache) {
    return localEnvCache;
  }

  const merged = readLocalEnvFilesSync(ROOT, LOCAL_ENV_FILES);
  localEnvCache = merged;
  return merged;
}

function resolveLocalEnvValue(key = "") {
  return String(process.env[key] || readLocalEnv()[key] || "").trim();
}

function getLocalUpstreamOrigin() {
  return resolveLocalEnvValue("LOCAL_UPSTREAM_ORIGIN").replace(/\/+$/, "");
}

async function proxyJsonToUpstream(request, response, requestOrigin, url) {
  const upstreamOrigin = getLocalUpstreamOrigin();
  if (!upstreamOrigin) {
    return false;
  }

  const method = String(request.method || "").toUpperCase();
  if (!["GET", "HEAD"].includes(method)) {
    return false;
  }

  const accessCode = String(request.headers["x-access-code"] || "").trim();
  if (!accessCode) {
    return false;
  }

  const targetUrl = new URL(`${url.pathname}${url.search}`, upstreamOrigin);
  const upstreamResponse = await fetch(targetUrl, {
    method,
    headers: {
      Accept: "application/json",
      "X-Access-Code": accessCode,
    },
  });

  const payload = await upstreamResponse.text();
  setCommonHeaders(response, requestOrigin);
  response.writeHead(upstreamResponse.status, {
    "Content-Type": upstreamResponse.headers.get("content-type") || "application/json; charset=utf-8",
  });
  response.end(payload);
  return true;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function dispatchApiRoute(request, response, url, requestOrigin = "") {
  const handler = API_ROUTE_HANDLERS.get(url.pathname);
  if (!handler) {
    return false;
  }

  const originalUrl = request.url;
  const rewrittenUrl = API_ROUTE_REWRITES.get(url.pathname);
  if (rewrittenUrl) {
    request.url = rewrittenUrl;
  }

  setCommonHeaders(response, requestOrigin);
  try {
    await handler(request, response);
  } finally {
    request.url = originalUrl;
  }
  return true;
}

async function handleApi(request, response, url) {
  const requestOrigin = request.headers.origin || "";
  if (!isAllowedOrigin(requestOrigin)) {
    sendJson(response, 403, { error: "허용되지 않은 Origin입니다." });
    return true;
  }

  if (request.method === "OPTIONS") {
    setCommonHeaders(response, requestOrigin);
    response.writeHead(204);
    response.end();
    return true;
  }

  if (API_ROUTE_HANDLERS.has(url.pathname) && url.pathname !== "/api/access") {
    try {
      if (await proxyJsonToUpstream(request, response, requestOrigin, url)) {
        return true;
      }
    } catch (error) {
      console.warn(`Upstream proxy failed for ${url.pathname}: ${error.message}`);
    }
  }

  return dispatchApiRoute(request, response, url, requestOrigin);
}

async function handleStatic(response, requestPath, requestOrigin = "") {
  const filePath = resolvePublicPath(requestPath);
  if (!filePath) {
    sendText(response, 403, "text/plain; charset=utf-8", "Forbidden", requestOrigin);
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await handleStatic(response, path.posix.join(requestPath, "index.html"), requestOrigin);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const content = await fs.readFile(filePath);

    setCommonHeaders(response, requestOrigin);
    response.writeHead(200, {
      "Content-Type": contentType,
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "text/plain; charset=utf-8", "Not Found", requestOrigin);
      return;
    }

    sendText(response, 500, "text/plain; charset=utf-8", error.message, requestOrigin);
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (await handleApi(request, response, url)) {
    return;
  }

  await handleStatic(response, url.pathname, request.headers.origin || "");
});

server.listen(PORT, HOST, () => {
  console.log(`Sniper Capital Board server listening on http://${HOST}:${PORT}`);
});
