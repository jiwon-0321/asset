#!/usr/bin/env node

const http = require("http");
const fsSync = require("fs");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const { loadPortfolio } = require("./portfolio-store");
const { searchAssets } = require("../lib/asset-search-service");
const { buildAssetChartSnapshot } = require("../lib/asset-chart-service");
const { buildLivePriceSnapshot } = require("../lib/live-price-service");
const { loadPersistedNotes, savePersistedNotes } = require("../lib/server-state-store");
const {
  createTarget,
  createTrade,
  deleteTargetEntry,
  deleteTradeEntry,
  getCurrentPortfolio,
  updateTradeEntry,
} = require("../lib/persisted-portfolio-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");

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

function isAllowedOrigin(origin) {
  return !origin || ALLOWED_ORIGINS.has(origin);
}

function setCommonHeaders(response, requestOrigin = "") {
  if (requestOrigin && isAllowedOrigin(requestOrigin)) {
    response.setHeader("Access-Control-Allow-Origin", requestOrigin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Access-Code");
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

function parseEnvContent(content = "") {
  return content.split(/\r?\n/).reduce((env, line) => {
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

function readLocalEnv() {
  if (localEnvCache) {
    return localEnvCache;
  }

  const merged = {};
  LOCAL_ENV_FILES.forEach((fileName) => {
    const filePath = path.join(ROOT, fileName);
    try {
      const content = fsSync.readFileSync(filePath, "utf8");
      Object.assign(merged, parseEnvContent(content));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  });

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

  const accessCode = String(request.headers["x-access-code"] || "").trim();
  if (!accessCode) {
    return false;
  }

  const targetUrl = new URL(`${url.pathname}${url.search}`, upstreamOrigin);
  const body = ["GET", "HEAD"].includes(String(request.method || "").toUpperCase()) ? undefined : await readRequestBody(request);
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers: {
      Accept: "application/json",
      "X-Access-Code": accessCode,
      ...(body ? { "Content-Type": request.headers["content-type"] || "application/json" } : {}),
    },
    body,
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

  const bundledPortfolioData = await loadPortfolio(ROOT);
  const protectedPathnames = new Set(["/api/access", "/api/portfolio", "/api/live-prices", "/api/asset-chart", "/api/asset-search", "/api/trades", "/api/targets", "/api/notes"]);
  const profile = url.pathname === "/api/access"
    ? null
    : protectedPathnames.has(url.pathname)
      ? resolveAccessProfile(request.headers["x-access-code"], bundledPortfolioData)
      : null;

  if (profile && !profile.ok) {
    const failure = getAccessFailureResponse(profile);
    sendJson(response, failure.statusCode, failure.payload, requestOrigin);
    return true;
  }

  const upstreamProxyPathnames = new Set([
    "/api/portfolio",
    "/api/live-prices",
    "/api/asset-chart",
    "/api/asset-search",
    "/api/trades",
    "/api/targets",
    "/api/notes",
  ]);
  if (profile && upstreamProxyPathnames.has(url.pathname)) {
    try {
      if (await proxyJsonToUpstream(request, response, requestOrigin, url)) {
        return true;
      }
    } catch (error) {
      console.warn(`Upstream proxy failed for ${url.pathname}: ${error.message}`);
    }
  }

  if (url.pathname === "/api/access" && request.method === "POST") {
    try {
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || "{}");
      const accessProfile = resolveAccessProfile(payload.code, bundledPortfolioData);
      if (!accessProfile.ok) {
        const failure = getAccessFailureResponse(accessProfile);
        sendJson(response, failure.statusCode, failure.payload, requestOrigin);
        return true;
      }
      sendJson(response, 200, { ok: true, mode: accessProfile.mode }, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/portfolio" && request.method === "GET") {
    try {
      const portfolio = await getCurrentPortfolio(ROOT, profile.seedPortfolio, profile.stateKey);
      sendJson(response, 200, portfolio, requestOrigin);
    } catch (error) {
      sendJson(response, 500, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/live-prices" && request.method === "GET") {
    try {
      const snapshot = await buildLivePriceSnapshot({ rootDir: ROOT, portfolioData: profile.seedPortfolio, stateKey: profile.stateKey });
      sendJson(response, 200, snapshot, requestOrigin);
    } catch (error) {
      sendJson(response, 500, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/asset-chart" && request.method === "GET") {
    try {
      const snapshot = await buildAssetChartSnapshot({
        rootDir: ROOT,
        market: url.searchParams.get("market") || "",
        symbol: url.searchParams.get("symbol") || "",
        name: url.searchParams.get("name") || "",
        range: url.searchParams.get("range") || "1M",
        granularity: url.searchParams.get("granularity") || "day",
      });
      sendJson(response, 200, snapshot, requestOrigin);
    } catch (error) {
      sendJson(response, 500, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/asset-search" && request.method === "GET") {
    try {
      const suggestions = await searchAssets({
        rootDir: ROOT,
        market: url.searchParams.get("market") || "",
        query: url.searchParams.get("query") || "",
      });
      sendJson(response, 200, { suggestions }, requestOrigin);
    } catch (error) {
      sendJson(response, 500, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/trades" && request.method === "POST") {
    try {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." }, requestOrigin);
        return true;
      }
      const body = await readRequestBody(request);
      const trade = JSON.parse(body || "{}");
      const updatedPortfolio = await createTrade(ROOT, trade, profile.seedPortfolio, profile.stateKey);
      sendJson(response, 200, updatedPortfolio, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/trades" && request.method === "PUT") {
    try {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." }, requestOrigin);
        return true;
      }
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || "{}");
      const updatedPortfolio = await updateTradeEntry(ROOT, payload, profile.seedPortfolio, profile.stateKey);
      sendJson(response, 200, updatedPortfolio, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/trades" && request.method === "DELETE") {
    try {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." }, requestOrigin);
        return true;
      }
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || "{}");
      const updatedPortfolio = await deleteTradeEntry(ROOT, payload, profile.seedPortfolio, profile.stateKey);
      sendJson(response, 200, updatedPortfolio, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/targets" && request.method === "POST") {
    try {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." }, requestOrigin);
        return true;
      }
      const body = await readRequestBody(request);
      const target = JSON.parse(body || "{}");
      const updatedPortfolio = await createTarget(ROOT, target, profile.seedPortfolio, profile.stateKey);
      sendJson(response, 200, updatedPortfolio, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/targets" && request.method === "DELETE") {
    try {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." }, requestOrigin);
        return true;
      }
      const body = await readRequestBody(request);
      const target = JSON.parse(body || "{}");
      const updatedPortfolio = await deleteTargetEntry(ROOT, target, profile.seedPortfolio, profile.stateKey);
      sendJson(response, 200, updatedPortfolio, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/notes" && request.method === "GET") {
    try {
      const notes = profile.mode === "owner" ? await loadPersistedNotes(ROOT, profile.stateKey) : [];
      sendJson(response, 200, { notes }, requestOrigin);
    } catch (error) {
      sendJson(response, 500, { error: error.message }, requestOrigin);
    }
    return true;
  }

  if (url.pathname === "/api/notes" && ["POST", "PUT", "DELETE"].includes(request.method || "")) {
    try {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." }, requestOrigin);
        return true;
      }
      const body = await readRequestBody(request);
      const payload = JSON.parse(body || "{}");
      const notes = await loadPersistedNotes(ROOT, profile.stateKey);

      if (request.method === "POST") {
        const timestamp = new Date().toISOString();
        const next = [
          {
            id: `note-${Date.now()}`,
            title: String(payload.title || "").trim(),
            body: String(payload.body || "").trim(),
            createdAt: timestamp,
            updatedAt: timestamp,
          },
          ...notes,
        ];
        await savePersistedNotes(ROOT, next, profile.stateKey);
        sendJson(response, 200, { notes: next }, requestOrigin);
        return true;
      }

      if (request.method === "PUT") {
        const noteId = String(payload.id || "").trim();
        const timestamp = new Date().toISOString();
        const next = notes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                title: String(payload.title || "").trim(),
                body: String(payload.body || "").trim(),
                updatedAt: timestamp,
              }
            : note
        );
        await savePersistedNotes(ROOT, next, profile.stateKey);
        sendJson(response, 200, { notes: next }, requestOrigin);
        return true;
      }

      const noteId = String(payload.id || "").trim();
      const next = notes.filter((note) => note.id !== noteId);
      await savePersistedNotes(ROOT, next, profile.stateKey);
      sendJson(response, 200, { notes: next }, requestOrigin);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message }, requestOrigin);
    }
    return true;
  }

  return false;
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
