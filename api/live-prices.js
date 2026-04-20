const path = require("path");
const { buildLivePriceSnapshot } = require("../lib/live-price-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");

const LIVE_PRICE_FRESH_MS = 1500;
const LIVE_PRICE_STALE_MS = 8000;
const livePriceSnapshotCache = new Map();

function resolveLivePriceSeedPortfolio(profile = null) {
  const stateKey = String(profile?.stateKey || "").trim();
  if (!profile?.seedPortfolio) {
    return null;
  }

  return profile?.mode === "guest" || (profile?.mode === "owner" && stateKey && stateKey !== "owner")
    ? profile.seedPortfolio
    : null;
}

function shouldBypassLivePriceCache(request) {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    return url.searchParams.has("_ts") || url.searchParams.get("force") === "1";
  } catch (_error) {
    return false;
  }
}

function getLivePriceCacheEntry(cacheKey = "") {
  return livePriceSnapshotCache.get(String(cacheKey || "owner")) || null;
}

function setLivePriceCacheEntry(cacheKey = "", patch = {}) {
  const key = String(cacheKey || "owner");
  const previous = getLivePriceCacheEntry(key) || {};
  const next = {
    ...previous,
    ...patch,
  };
  livePriceSnapshotCache.set(key, next);
  return next;
}

async function refreshLivePriceSnapshot(cacheKey = "", loader = async () => ({})) {
  const key = String(cacheKey || "owner");
  const existing = getLivePriceCacheEntry(key);
  if (existing?.refreshPromise) {
    return existing.refreshPromise;
  }

  const refreshPromise = (async () => {
    try {
      const snapshot = await loader();
      setLivePriceCacheEntry(key, {
        snapshot,
        updatedAt: Date.now(),
      });
      return snapshot;
    } catch (error) {
      const fallback = getLivePriceCacheEntry(key)?.snapshot || null;
      if (fallback) {
        return fallback;
      }
      throw error;
    } finally {
      const current = getLivePriceCacheEntry(key);
      if (current?.refreshPromise === refreshPromise) {
        setLivePriceCacheEntry(key, {
          refreshPromise: null,
        });
      }
    }
  })();

  setLivePriceCacheEntry(key, {
    refreshPromise,
  });
  return refreshPromise;
}

async function resolveLivePriceSnapshot(cacheKey = "", loader = async () => ({})) {
  const key = String(cacheKey || "owner");
  const entry = getLivePriceCacheEntry(key);
  const age = entry?.updatedAt ? Date.now() - Number(entry.updatedAt) : Number.POSITIVE_INFINITY;

  if (entry?.snapshot && age <= LIVE_PRICE_FRESH_MS) {
    return entry.snapshot;
  }

  if (entry?.snapshot && age <= LIVE_PRICE_STALE_MS) {
    void refreshLivePriceSnapshot(key, loader);
    return entry.snapshot;
  }

  return refreshLivePriceSnapshot(key, loader);
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

    const loader = () =>
      buildLivePriceSnapshot({
        rootDir: path.resolve(__dirname, ".."),
        portfolioData: resolveLivePriceSeedPortfolio(profile),
        stateKey: profile.stateKey,
      });
    const payload = shouldBypassLivePriceCache(request)
      ? await refreshLivePriceSnapshot(profile.stateKey, loader)
      : await resolveLivePriceSnapshot(profile.stateKey, loader);

    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: error.message || "실시간 시세를 불러오지 못했습니다." }));
  }
};

module.exports.resolveLivePriceSeedPortfolio = resolveLivePriceSeedPortfolio;
