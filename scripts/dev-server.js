#!/usr/bin/env node

const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const { addTrade, loadPortfolio } = require("./portfolio-store");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = path.resolve(__dirname, "..");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function setCommonHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

function sendJson(response, statusCode, payload) {
  setCommonHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, contentType, body) {
  setCommonHeaders(response);
  response.writeHead(statusCode, {
    "Content-Type": contentType,
  });
  response.end(body);
}

function resolvePublicPath(requestPath) {
  const normalizedPath = decodeURIComponent(requestPath === "/" ? "/index.html" : requestPath);
  const absolutePath = path.resolve(ROOT, `.${normalizedPath}`);

  if (!absolutePath.startsWith(ROOT)) {
    return null;
  }

  return absolutePath;
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    setCommonHeaders(response);
    response.writeHead(204);
    response.end();
    return true;
  }

  if (url.pathname === "/api/portfolio" && request.method === "GET") {
    try {
      const portfolio = await loadPortfolio(ROOT);
      sendJson(response, 200, portfolio);
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return true;
  }

  if (url.pathname === "/api/trades" && request.method === "POST") {
    try {
      const body = await readRequestBody(request);
      const trade = JSON.parse(body || "{}");
      const updatedPortfolio = await addTrade(ROOT, trade);
      sendJson(response, 200, updatedPortfolio);
    } catch (error) {
      const statusCode = error instanceof SyntaxError ? 400 : 422;
      sendJson(response, statusCode, { error: error.message });
    }
    return true;
  }

  return false;
}

async function handleStatic(response, requestPath) {
  const filePath = resolvePublicPath(requestPath);
  if (!filePath) {
    sendText(response, 403, "text/plain; charset=utf-8", "Forbidden");
    return;
  }

  try {
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      await handleStatic(response, path.posix.join(requestPath, "index.html"));
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[extension] || "application/octet-stream";
    const content = await fs.readFile(filePath);

    setCommonHeaders(response);
    response.writeHead(200, {
      "Content-Type": contentType,
    });
    response.end(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(response, 404, "text/plain; charset=utf-8", "Not Found");
      return;
    }

    sendText(response, 500, "text/plain; charset=utf-8", error.message);
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (await handleApi(request, response, url)) {
    return;
  }

  await handleStatic(response, url.pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`Sniper Capital Board server listening on http://${HOST}:${PORT}`);
});
