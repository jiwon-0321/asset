const fs = require("fs/promises");
const path = require("path");

const {
  buildChartData,
  normalizeMoney,
  normalizeRate,
  rebuildAssetStatus,
  rebuildSummary,
  updateAssetPrice,
} = require("../scripts/portfolio-store");
const { normalizeHoldingMetadata, normalizeTargetGroups } = require("./asset-metadata");
const { hasBlobStorage, loadPersistedPortfolio } = require("./server-state-store");

const CRYPTO_REFRESH_INTERVAL_SECONDS = 10;
const MARKET_REFRESH_INTERVAL_SECONDS = 120;
const MARKET_CLOSED_REFRESH_INTERVAL_SECONDS = 900;
const GLOBAL_CRYPTO_REFRESH_INTERVAL_SECONDS = 60;
const TWELVE_DATA_API_KEY = "TWELVE_DATA_API_KEY";
const EMPTY_FX = Object.freeze({
  usdkrw: null,
  source: "twelve-data",
  updatedAt: null,
  isDelayed: true,
});
const livePriceCache = {
  crypto: {
    updatedAt: null,
    quotes: {},
  },
  market: {
    updatedAt: null,
    quotes: {},
    fx: { ...EMPTY_FX },
    refreshIntervalSeconds: MARKET_REFRESH_INTERVAL_SECONDS,
  },
  globalCrypto: {
    updatedAt: null,
    references: {},
  },
};

function parseEnvContent(content = "") {
  return content.split(/\r?\n/).reduce((env, line) => {
    const trimmed = line.trim();
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

async function readLocalEnv(rootDir) {
  const candidates = [".env.local", ".env"];
  const merged = {};

  for (const fileName of candidates) {
    const filePath = path.join(rootDir, fileName);
    try {
      const content = await fs.readFile(filePath, "utf8");
      Object.assign(merged, parseEnvContent(content));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return merged;
}

async function resolveEnvValue(rootDir, key) {
  if (process.env[key]) {
    return process.env[key];
  }

  const localEnv = await readLocalEnv(rootDir);
  return localEnv[key] || "";
}

function collectTrackedInstruments(holdings, targets) {
  const unique = new Map();

  holdings
    .filter((item) => Number(item.quantity || 0) > 0)
    .forEach((item) => {
      const enriched = normalizeHoldingMetadata(item);
      const identity = enriched.symbol || enriched.asset;
      if (!identity) {
        return;
      }

      const key = `${enriched.market || "unknown"}::${identity}`;
      unique.set(key, {
        name: enriched.name || enriched.asset,
        asset: enriched.asset,
        symbol: enriched.symbol,
        market: enriched.market,
        currency: enriched.currency,
        priceSource: enriched.priceSource,
        scope: "holding",
      });
    });

  (targets.groups || []).forEach((group) => {
    (group.items || []).forEach((item) => {
      const identity = item.symbol || item.name;
      if (!identity) {
        return;
      }

      const key = `${item.market || "unknown"}::${identity}`;
      if (!unique.has(key)) {
        unique.set(key, {
          name: item.name,
          asset: item.name,
          symbol: item.symbol,
          market: item.market,
          currency: item.currency,
          priceSource: item.priceSource,
          scope: "target",
        });
      }
    });
  });

  return [...unique.values()];
}

async function fetchJson(url, fetchImpl) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function createUnavailableQuote(instrument, message) {
  return {
    ...instrument,
    available: false,
    price: null,
    priceKrw: null,
    priceUsd: null,
    changePercent: null,
    isMarketOpen: null,
    isDelayed: true,
    updatedAt: null,
    error: message,
  };
}

function resolveMarketRefreshInterval(quotes = {}) {
  const marketQuotes = Object.values(quotes).filter((quote) => quote?.market === "us-stock");
  if (!marketQuotes.length) {
    return MARKET_REFRESH_INTERVAL_SECONDS;
  }

  const openQuote = marketQuotes.find((quote) => quote.available && quote.isMarketOpen === true);
  if (openQuote) {
    return MARKET_REFRESH_INTERVAL_SECONDS;
  }

  const closedQuote = marketQuotes.find((quote) => quote.available && quote.isMarketOpen === false);
  if (closedQuote) {
    return MARKET_CLOSED_REFRESH_INTERVAL_SECONDS;
  }

  return MARKET_REFRESH_INTERVAL_SECONDS;
}

function resolveCoinGeckoId(instrument = {}) {
  const symbol = String(instrument.symbol || "").trim().toUpperCase();
  const name = String(instrument.name || instrument.asset || "").trim();
  const normalizedName = name.toUpperCase();

  if (symbol === "KRW-BTC" || normalizedName === "BTC" || name === "비트코인" || name === "비트코인(BTC)") {
    return "bitcoin";
  }
  if (symbol === "KRW-ETH" || normalizedName === "ETH" || name === "이더리움" || name === "이더리움(ETH)") {
    return "ethereum";
  }
  if (symbol === "KRW-XRP" || normalizedName === "XRP" || name === "엑스알피" || name === "엑스알피(XRP)") {
    return "ripple";
  }
  if (symbol === "KRW-SOL" || normalizedName === "SOL" || name === "솔라나" || name === "솔라나(SOL)") {
    return "solana";
  }
  if (symbol === "KRW-DOGE" || normalizedName === "DOGE" || name === "도지코인" || name === "도지코인(DOGE)") {
    return "dogecoin";
  }
  if (symbol === "KRW-ADA" || normalizedName === "ADA" || name === "에이다" || name === "에이다(ADA)") {
    return "cardano";
  }
  if (symbol === "KRW-SUI" || normalizedName === "SUI" || name === "수이" || name === "수이(SUI)") {
    return "sui";
  }
  if (symbol === "KRW-AVAX" || normalizedName === "AVAX" || name === "아발란체" || name === "아발란체(AVAX)") {
    return "avalanche-2";
  }

  return "";
}

function isCacheFresh(updatedAt, intervalSeconds) {
  if (!updatedAt) {
    return false;
  }

  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() - timestamp < intervalSeconds * 1000;
}

function hasAllCachedQuotes(cacheQuotes, instruments) {
  return instruments.every((instrument) => cacheQuotes[instrument.name]);
}

function pickCachedQuotes(cacheQuotes, instruments, markDelayed = false) {
  return instruments.reduce((quotes, instrument) => {
    const cached = cacheQuotes[instrument.name];
    if (!cached) {
      return quotes;
    }

    quotes[instrument.name] = {
      ...cached,
      isDelayed: markDelayed ? true : Boolean(cached.isDelayed),
    };
    return quotes;
  }, {});
}

async function fetchUpbitQuotes(instruments, fetchImpl) {
  const cryptoInstruments = instruments.filter((item) => item.priceSource === "upbit" && item.symbol);
  if (!cryptoInstruments.length) {
    return {};
  }

  const url = new URL("https://api.upbit.com/v1/ticker");
  url.searchParams.set(
    "markets",
    [...new Set(cryptoInstruments.map((item) => item.symbol))].join(",")
  );

  const payload = await fetchJson(url, fetchImpl);
  const marketMap = new Map(payload.map((item) => [item.market, item]));

  return cryptoInstruments.reduce((quotes, instrument) => {
    const ticker = marketMap.get(instrument.symbol);
    if (!ticker) {
      quotes[instrument.name] = createUnavailableQuote(instrument, "현재가를 찾지 못했습니다.");
      return quotes;
    }

    quotes[instrument.name] = {
      ...instrument,
      available: true,
      price: normalizeMoney(Number(ticker.trade_price || 0)),
      priceKrw: normalizeMoney(Number(ticker.trade_price || 0)),
      priceUsd: null,
      changePercent: normalizeRate(Number(ticker.signed_change_rate || 0)),
      isMarketOpen: true,
      isDelayed: false,
      updatedAt: new Date().toISOString(),
      error: null,
    };
    return quotes;
  }, {});
}

async function fetchCoinGeckoReferences(instruments, fetchImpl) {
  const cryptoInstruments = instruments.filter((item) => item.market === "crypto");
  const ids = [...new Set(cryptoInstruments.map((item) => resolveCoinGeckoId(item)).filter(Boolean))];
  if (!ids.length) {
    return {};
  }

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", "usd,krw");
  url.searchParams.set("include_last_updated_at", "true");

  const payload = await fetchJson(url, fetchImpl);
  return cryptoInstruments.reduce((references, instrument) => {
    const coinId = resolveCoinGeckoId(instrument);
    const reference = payload?.[coinId];
    if (!reference) {
      return references;
    }

    const globalPriceKrw = normalizeMoney(Number(reference.krw || 0));
    const globalPriceUsd = normalizeMoney(Number(reference.usd || 0));
    if (!globalPriceKrw || !globalPriceUsd) {
      return references;
    }

    references[instrument.name] = {
      globalPriceKrw,
      globalPriceUsd,
      globalUpdatedAt: reference.last_updated_at
        ? new Date(Number(reference.last_updated_at) * 1000).toISOString()
        : new Date().toISOString(),
    };
    return references;
  }, {});
}

function applyKimchiPremiumToQuotes(quotes, references) {
  Object.keys(quotes).forEach((key) => {
    const quote = quotes[key];
    const reference = references[key];
    if (!quote || quote.market !== "crypto" || !reference) {
      return;
    }

    const localPriceKrw = Number(quote.priceKrw);
    const globalPriceKrw = Number(reference.globalPriceKrw);
    if (!Number.isFinite(localPriceKrw) || localPriceKrw <= 0 || !Number.isFinite(globalPriceKrw) || globalPriceKrw <= 0) {
      return;
    }

    quote.globalPriceKrw = reference.globalPriceKrw;
    quote.globalPriceUsd = reference.globalPriceUsd;
    quote.globalUpdatedAt = reference.globalUpdatedAt;
    quote.kimchiPremiumPercent = normalizeRate(localPriceKrw / globalPriceKrw - 1);
  });
}

async function fetchTwelveDataFxRate(apiKey, fetchImpl) {
  const url = new URL("https://api.twelvedata.com/currency_conversion");
  url.searchParams.set("symbol", "USD/KRW");
  url.searchParams.set("amount", "1");
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl);
  if (payload.status === "error") {
    throw new Error(payload.message || "환율 조회에 실패했습니다.");
  }

  const rawRate = Number(payload.rate || payload.amount || payload.converted_amount || 0);
  if (!Number.isFinite(rawRate) || rawRate <= 0) {
    throw new Error("유효한 USD/KRW 환율을 받지 못했습니다.");
  }

  return {
    usdkrw: normalizeMoney(rawRate),
    source: "twelve-data",
    updatedAt: new Date().toISOString(),
    isDelayed: false,
  };
}

async function fetchTwelveDataStockQuote(instrument, apiKey, fetchImpl) {
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", instrument.symbol);
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl);
  if (payload.status === "error") {
    throw new Error(payload.message || `${instrument.symbol} 현재가 조회에 실패했습니다.`);
  }

  const close = Number(payload.close || payload.price || 0);
  if (!Number.isFinite(close) || close <= 0) {
    throw new Error(`${instrument.symbol} 유효한 가격을 받지 못했습니다.`);
  }

  return {
    priceUsd: normalizeMoney(close),
    changePercent: Number.isFinite(Number(payload.percent_change))
      ? normalizeRate(Number(payload.percent_change) / 100)
      : null,
    isMarketOpen: typeof payload.is_market_open === "boolean" ? payload.is_market_open : null,
    updatedAt: new Date().toISOString(),
  };
}

function buildQuoteStatus(errors, warnings, quotes) {
  const availableCount = Object.values(quotes).filter((quote) => quote.available).length;

  if (availableCount === 0 && errors.length) {
    return { level: "error", message: "실시간 가격을 불러오지 못했습니다." };
  }

  if (warnings.includes("missing-twelve-data-key")) {
    return {
      level: availableCount > 0 ? "warning" : "error",
      message: availableCount > 0 ? "미국주식 API 키 필요 · 코인만 실시간 반영 중" : "미국주식 API 키 필요",
    };
  }

  if (errors.length) {
    return { level: "warning", message: "일부 종목 업데이트 지연" };
  }

  return { level: "success", message: "실시간 업데이트 완료" };
}

function decorateQuoteForDisplay(quote, fxRate = null) {
  if (!quote) {
    return null;
  }

  const next = { ...quote };
  if (quote.market === "us-stock" && fxRate && Number.isFinite(quote.priceUsd)) {
    next.priceKrw = normalizeMoney(quote.priceUsd * fxRate);
  }

  return next;
}

function buildLiveHolding(holding, quotes) {
  const enriched = normalizeHoldingMetadata(holding);
  const quote = quotes[enriched.name] || null;
  const quantity = Number(enriched.quantity || 0);
  const principal = normalizeMoney(quantity * Number(enriched.averagePrice || 0));
  const fallbackUnitPriceKrw =
    quantity > 0 ? normalizeMoney(Number(enriched.valuation || 0) / quantity) : normalizeMoney(Number(enriched.averagePrice || 0));
  const currentPriceKrw =
    quote && Number.isFinite(quote.priceKrw) && quote.priceKrw > 0 ? quote.priceKrw : fallbackUnitPriceKrw;
  const valuation = normalizeMoney(quantity * currentPriceKrw);
  const pnl = normalizeMoney(valuation - principal);

  return {
    ...enriched,
    valuation,
    returnRate: principal ? normalizeRate(pnl / principal) : 0,
    currentPrice: quote?.price ?? currentPriceKrw,
    currentPriceKrw,
    currentPriceUsd: quote?.priceUsd ?? null,
    liveQuote: quote,
  };
}

function buildLiveTargets(targets, quotes) {
  return {
    ...targets,
    groups: (targets.groups || []).map((group) => ({
      ...group,
      items: (group.items || []).map((item) => ({
        ...item,
        liveQuote: quotes[item.name] || createUnavailableQuote(item, "실시간 연결 준비 중"),
      })),
    })),
  };
}

async function buildLivePriceSnapshot({ rootDir, fetchImpl = fetch, portfolioData = null, stateKey = "owner" }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch 구현을 찾지 못했습니다.");
  }

  const portfolio =
    portfolioData && !hasBlobStorage()
      ? structuredClone(portfolioData)
      : await loadPersistedPortfolio(rootDir, portfolioData, stateKey);
  const holdings = (portfolio.holdings || []).map((item) => normalizeHoldingMetadata(item));
  const targets = normalizeTargetGroups(portfolio.targets || {});
  const instruments = collectTrackedInstruments(holdings, targets);
  const quotes = {};
  const errors = [];
  const warnings = [];
  const hasFreshCryptoCache =
    isCacheFresh(livePriceCache.crypto.updatedAt, CRYPTO_REFRESH_INTERVAL_SECONDS) &&
    hasAllCachedQuotes(livePriceCache.crypto.quotes, instruments.filter((item) => item.priceSource === "upbit" && item.symbol));
  const cryptoInstruments = instruments.filter((item) => item.priceSource === "upbit" && item.symbol);
  const kimchiEligibleInstruments = instruments.filter((item) => item.market === "crypto" && resolveCoinGeckoId(item));
  const hasFreshGlobalCryptoCache =
    isCacheFresh(livePriceCache.globalCrypto.updatedAt, GLOBAL_CRYPTO_REFRESH_INTERVAL_SECONDS) &&
    hasAllCachedQuotes(livePriceCache.globalCrypto.references, kimchiEligibleInstruments);

  if (hasFreshCryptoCache) {
    Object.assign(
      quotes,
      pickCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments)
    );
  } else {
    try {
      const cryptoQuotes = await fetchUpbitQuotes(instruments, fetchImpl);
      livePriceCache.crypto = {
        updatedAt: new Date().toISOString(),
        quotes: cryptoQuotes,
      };
      Object.assign(quotes, cryptoQuotes);
    } catch (error) {
      errors.push(`crypto:${error.message}`);

      if (hasAllCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments)) {
        Object.assign(
          quotes,
          pickCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments, true)
        );
      }
    }
  }

  if (kimchiEligibleInstruments.length) {
    if (hasFreshGlobalCryptoCache) {
      applyKimchiPremiumToQuotes(quotes, livePriceCache.globalCrypto.references);
    } else {
      try {
        const globalReferences = await fetchCoinGeckoReferences(instruments, fetchImpl);
        livePriceCache.globalCrypto = {
          updatedAt: new Date().toISOString(),
          references: {
            ...livePriceCache.globalCrypto.references,
            ...globalReferences,
          },
        };
        applyKimchiPremiumToQuotes(quotes, livePriceCache.globalCrypto.references);
      } catch (error) {
        warnings.push(`kimchi-premium:${error.message}`);
        if (hasAllCachedQuotes(livePriceCache.globalCrypto.references, kimchiEligibleInstruments)) {
          applyKimchiPremiumToQuotes(quotes, livePriceCache.globalCrypto.references);
        }
      }
    }
  }

  const usStockInstruments = instruments.filter((item) => item.market === "us-stock" && item.symbol);
  let fx = { ...EMPTY_FX };
  let marketRefreshIntervalSeconds = livePriceCache.market.refreshIntervalSeconds || MARKET_REFRESH_INTERVAL_SECONDS;
  const hasFreshMarketCache =
    isCacheFresh(livePriceCache.market.updatedAt, marketRefreshIntervalSeconds) &&
    hasAllCachedQuotes(livePriceCache.market.quotes, usStockInstruments) &&
    (usStockInstruments.length === 0 || Number.isFinite(Number(livePriceCache.market.fx?.usdkrw)));

  if (usStockInstruments.length) {
    if (hasFreshMarketCache) {
      fx = { ...livePriceCache.market.fx };
      marketRefreshIntervalSeconds = livePriceCache.market.refreshIntervalSeconds || marketRefreshIntervalSeconds;
      Object.assign(quotes, pickCachedQuotes(livePriceCache.market.quotes, usStockInstruments));
    } else {
      const apiKey = await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY);
      if (!apiKey) {
        warnings.push("missing-twelve-data-key");
        usStockInstruments.forEach((instrument) => {
          quotes[instrument.name] = createUnavailableQuote(instrument, "미국주식 API 키 필요");
        });
      } else {
        try {
          fx = await fetchTwelveDataFxRate(apiKey, fetchImpl);
          const stockResults = await Promise.allSettled(
            usStockInstruments.map((instrument) => fetchTwelveDataStockQuote(instrument, apiKey, fetchImpl))
          );
          const marketQuotes = {};

          stockResults.forEach((result, index) => {
            const instrument = usStockInstruments[index];
            if (result.status === "fulfilled") {
              marketQuotes[instrument.name] = decorateQuoteForDisplay(
                {
                  ...instrument,
                  available: true,
                  price: result.value.priceUsd,
                  priceUsd: result.value.priceUsd,
                  priceKrw: null,
                  changePercent: result.value.changePercent,
                  isMarketOpen: result.value.isMarketOpen,
                  isDelayed: false,
                  updatedAt: result.value.updatedAt,
                  error: null,
                },
                fx.usdkrw
              );
              return;
            }

            errors.push(`stock:${instrument.symbol}:${result.reason.message}`);
            marketQuotes[instrument.name] = createUnavailableQuote(instrument, "현재가를 불러오지 못했습니다.");
          });

          marketRefreshIntervalSeconds = resolveMarketRefreshInterval(marketQuotes);

          livePriceCache.market = {
            updatedAt: new Date().toISOString(),
            quotes: marketQuotes,
            fx,
            refreshIntervalSeconds: marketRefreshIntervalSeconds,
          };
          Object.assign(quotes, marketQuotes);
        } catch (error) {
          errors.push(`market:${error.message}`);

          if (hasAllCachedQuotes(livePriceCache.market.quotes, usStockInstruments)) {
            fx = {
              ...livePriceCache.market.fx,
              isDelayed: true,
            };
            marketRefreshIntervalSeconds = livePriceCache.market.refreshIntervalSeconds || marketRefreshIntervalSeconds;
            Object.assign(quotes, pickCachedQuotes(livePriceCache.market.quotes, usStockInstruments, true));
          } else {
            usStockInstruments.forEach((instrument) => {
              quotes[instrument.name] = createUnavailableQuote(instrument, "현재가를 불러오지 못했습니다.");
            });
          }
        }
      }
    }
  }

  const liveHoldings = holdings.map((holding) => buildLiveHolding(holding, quotes));
  const liveAssetStatus = rebuildAssetStatus(liveHoldings);
  const liveSummary = rebuildSummary(
    portfolio.summary,
    liveAssetStatus,
    portfolio.cashPositions || [],
    portfolio.realized || [],
    portfolio.metadata || {}
  );
  const liveCharts = buildChartData({
    basisDateLabel: portfolio.metadata?.basisDateLabel,
    performanceStartDate: portfolio.metadata?.realizedPerformanceStartDate,
    holdings: liveHoldings,
    realized: portfolio.realized || [],
  });

  const analytics = structuredClone(portfolio.analytics || {});
  liveHoldings.forEach((holding) => {
    updateAssetPrice(analytics, holding.asset, holding.currentPriceKrw);
  });

  const liveTargets = buildLiveTargets(targets, quotes);
  const status = buildQuoteStatus(errors, warnings, quotes);
  const updatedAt = new Date().toISOString();

  return {
    updatedAt,
    live: {
      updatedAt,
      refreshIntervalSeconds: CRYPTO_REFRESH_INTERVAL_SECONDS,
      cryptoRefreshIntervalSeconds: CRYPTO_REFRESH_INTERVAL_SECONDS,
      marketRefreshIntervalSeconds,
      status,
      errors,
      warnings,
    },
    quotes,
    fx,
    portfolioLive: {
      summary: liveSummary,
      assetStatus: liveAssetStatus,
      holdings: liveHoldings,
      charts: {
        ...(portfolio.charts || {}),
        ...liveCharts,
      },
      analytics,
      targets: liveTargets,
    },
  };
}

module.exports = {
  CRYPTO_REFRESH_INTERVAL_SECONDS,
  MARKET_REFRESH_INTERVAL_SECONDS,
  MARKET_CLOSED_REFRESH_INTERVAL_SECONDS,
  buildLivePriceSnapshot,
};
