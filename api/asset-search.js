const path = require("path");
const { searchAssets } = require("../lib/asset-search-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_RATE_WINDOW_MS = 60 * 1000;
const SEARCH_RATE_LIMIT = 24;
const searchCache = new Map();
const searchRateLimits = new Map();

function getClientKey(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || request.headers["x-real-ip"] || request.socket?.remoteAddress || "unknown";
}

function takeRateLimitToken(clientKey) {
  const now = Date.now();
  const windowStart = now - SEARCH_RATE_WINDOW_MS;
  const previous = searchRateLimits.get(clientKey) || [];
  const recent = previous.filter((timestamp) => timestamp > windowStart);

  if (recent.length >= SEARCH_RATE_LIMIT) {
    return false;
  }

  recent.push(now);
  searchRateLimits.set(clientKey, recent);
  return true;
}

function readCachedSearchResult(cacheKey) {
  const cached = searchCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cached.value;
}

function writeCachedSearchResult(cacheKey, value) {
  searchCache.set(cacheKey, {
    value,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
  });
}

module.exports = async (request, response) => {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "Method Not Allowed" }));
    return;
  }

  try {
    const profile = resolveAccessProfile(request.headers["x-access-code"], getBundledPortfolioData());
    if (!profile.ok) {
      const failure = getAccessFailureResponse(profile);
      response.statusCode = failure.statusCode;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify(failure.payload));
      return;
    }

    const baseUrl = `http://${request.headers.host || "localhost"}`;
    const url = new URL(request.url || "/api/asset-search", baseUrl);
    const market = String(url.searchParams.get("market") || "").trim();
    const query = String(url.searchParams.get("query") || "").trim();
    const clientKey = `${profile.stateKey}:${getClientKey(request)}`;

    if (!takeRateLimitToken(clientKey)) {
      response.statusCode = 429;
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ error: "검색 요청이 너무 많습니다. 잠시 후 다시 시도해주세요." }));
      return;
    }

    if (!query) {
      response.statusCode = 200;
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ suggestions: [] }));
      return;
    }

    const cacheKey = `${profile.stateKey}:${market}:${query.toLowerCase()}`;
    const cachedSuggestions = readCachedSearchResult(cacheKey);
    if (cachedSuggestions) {
      response.statusCode = 200;
      response.setHeader("Cache-Control", "private, max-age=60");
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ suggestions: cachedSuggestions }));
      return;
    }

    const suggestions = await searchAssets({
      rootDir: path.resolve(__dirname, ".."),
      market,
      query,
    });
    writeCachedSearchResult(cacheKey, suggestions);

    response.statusCode = 200;
    response.setHeader("Cache-Control", "private, max-age=60");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ suggestions }));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message || "자산 검색에 실패했습니다." }));
  }
};
