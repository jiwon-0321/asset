const fs = require("fs/promises");
const path = require("path");
const { readLocalEnvFiles } = require("./env-file");

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
const MARKET_REFRESH_INTERVAL_SECONDS = 60;
const MARKET_CLOSED_REFRESH_INTERVAL_SECONDS = 24 * 60 * 60;
const MAJOR_INDEX_OPEN_REFRESH_INTERVAL_SECONDS = 600;
const MAJOR_INDEX_CLOSED_REFRESH_INTERVAL_SECONDS = 1800;
const GLOBAL_CRYPTO_REFRESH_INTERVAL_SECONDS = 60;
const GLOBAL_CRYPTO_RETRY_COOLDOWN_SECONDS = 45;
const FX_REFRESH_INTERVAL_SECONDS = 24 * 60 * 60;
const KR_MARKET_TIME_ZONE = "Asia/Seoul";
const US_MARKET_TIME_ZONE = "America/New_York";
const FX_REFRESH_TIME_ZONE = "Asia/Seoul";
const KR_MARKET_OPEN_MINUTES = 9 * 60;
const KR_MARKET_CLOSE_MINUTES = 15 * 60 + 30;
const US_MARKET_OPEN_MINUTES = 9 * 60 + 30;
const US_MARKET_CLOSE_MINUTES = 16 * 60;
const KIS_APP_KEY = "KIS_APP_KEY";
const KIS_APP_SECRET = "KIS_APP_SECRET";
const TWELVE_DATA_API_KEY = "TWELVE_DATA_API_KEY";
const KIS_API_BASE_URL = "https://openapi.koreainvestment.com:9443";
const KIS_ACCESS_TOKEN_URL = "/oauth2/tokenP";
const KIS_DOMESTIC_STOCK_QUOTE_URL = "/uapi/domestic-stock/v1/quotations/inquire-price";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const REQUEST_TIMEOUTS = Object.freeze({
  upbit: 1600,
  bithumb: 1700,
  coingeckoSpot: 1900,
  coingeckoReference: 900,
  kisAuth: 1600,
  kisQuote: 1600,
  twelveFx: 1400,
  twelveStock: 1600,
  yahooChart: 1700,
});
const MAJOR_INDEX_GROUPS = Object.freeze({
  // 국내 지수는 국내주식 API를 연결하는 다음 단계에서 활성화합니다.
  korea: Object.freeze([]),
  us: Object.freeze([
    // Twelve Data free 티어에서 인덱스 심볼 제한이 있어 지수 추종 ETF를 안정 기본값으로 사용합니다.
    { id: "nasdaq", label: "NASDAQ", symbol: "QQQ", aliases: [], tone: "global" },
    { id: "sp500", label: "S&P 500", symbol: "SPY", aliases: [], tone: "global" },
    { id: "dow", label: "DOW", symbol: "DIA", aliases: [], tone: "global" },
  ]),
});
const EMPTY_FX = Object.freeze({
  usdkrw: null,
  source: "twelve-data",
  updatedAt: null,
  isDelayed: true,
});

function createEmptyMajorIndexState() {
  return {
    korea: [],
    us: [],
  };
}

const livePriceCache = {
  crypto: {
    updatedAt: null,
    quotes: {},
  },
  market: {
    updatedAt: null,
    quotes: {},
    fx: { ...EMPTY_FX },
    indices: createEmptyMajorIndexState(),
    refreshIntervalSeconds: MARKET_REFRESH_INTERVAL_SECONDS,
    indicesUpdatedAt: null,
    indicesRefreshIntervalSeconds: MAJOR_INDEX_CLOSED_REFRESH_INTERVAL_SECONDS,
    refreshInFlight: null,
  },
  globalCrypto: {
    updatedAt: null,
    references: {},
    nextRetryAt: null,
  },
};

const zonedDateTimeFormatterCache = new Map();
const kisAuthCache = {
  token: "",
  expiresAt: null,
  inFlight: null,
};

async function readLocalEnv(rootDir) {
  return readLocalEnvFiles(rootDir);
}

async function resolveEnvValue(rootDir, key) {
  if (process.env[key]) {
    return process.env[key];
  }

  const localEnv = await readLocalEnv(rootDir);
  return localEnv[key] || "";
}

function getCurrentDate() {
  return new Date(Date.now());
}

function getZonedDateTimeFormatter(timeZone) {
  const key = String(timeZone || "UTC");
  if (!zonedDateTimeFormatterCache.has(key)) {
    zonedDateTimeFormatterCache.set(
      key,
      new Intl.DateTimeFormat("en-US", {
        timeZone: key,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
    );
  }

  return zonedDateTimeFormatterCache.get(key);
}

function getZonedDateTimeParts(date = getCurrentDate(), timeZone = "UTC") {
  const rawParts = getZonedDateTimeFormatter(timeZone).formatToParts(date);
  const parts = rawParts.reduce((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
    return result;
  }, {});

  return {
    weekday: String(parts.weekday || ""),
    year: Number(parts.year || 0),
    month: Number(parts.month || 0),
    day: Number(parts.day || 0),
    hour: Number(parts.hour || 0),
    minute: Number(parts.minute || 0),
    second: Number(parts.second || 0),
  };
}

function buildZonedDateKey(date = getCurrentDate(), timeZone = "UTC") {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function isSameZonedDate(left, right, timeZone = "UTC") {
  if (!left || !right) {
    return false;
  }

  return buildZonedDateKey(left, timeZone) === buildZonedDateKey(right, timeZone);
}

function isUsRegularMarketOpen(date = getCurrentDate()) {
  const parts = getZonedDateTimeParts(date, US_MARKET_TIME_ZONE);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") {
    return false;
  }

  const totalMinutes = parts.hour * 60 + parts.minute;
  return totalMinutes >= US_MARKET_OPEN_MINUTES && totalMinutes < US_MARKET_CLOSE_MINUTES;
}

function isUsTradingDay(date = getCurrentDate()) {
  const parts = getZonedDateTimeParts(date, US_MARKET_TIME_ZONE);
  return parts.weekday !== "Sat" && parts.weekday !== "Sun";
}

function isKrRegularMarketOpen(date = getCurrentDate()) {
  const parts = getZonedDateTimeParts(date, KR_MARKET_TIME_ZONE);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") {
    return false;
  }

  const totalMinutes = parts.hour * 60 + parts.minute;
  return totalMinutes >= KR_MARKET_OPEN_MINUTES && totalMinutes < KR_MARKET_CLOSE_MINUTES;
}

function isKrTradingDay(date = getCurrentDate()) {
  const parts = getZonedDateTimeParts(date, KR_MARKET_TIME_ZONE);
  return parts.weekday !== "Sat" && parts.weekday !== "Sun";
}

function shouldRefreshDaily(updatedAt, timeZone = FX_REFRESH_TIME_ZONE, date = getCurrentDate()) {
  if (!updatedAt) {
    return true;
  }

  const previousDate = new Date(updatedAt);
  if (!Number.isFinite(previousDate.getTime())) {
    return true;
  }

  return !isSameZonedDate(previousDate, date, timeZone);
}

function cloneCachedFx(markDelayed = false) {
  const cachedRate = Number(livePriceCache.market.fx?.usdkrw);
  if (!Number.isFinite(cachedRate) || cachedRate <= 0) {
    return { ...EMPTY_FX };
  }

  return {
    ...livePriceCache.market.fx,
    isDelayed: markDelayed ? true : Boolean(livePriceCache.market.fx?.isDelayed),
  };
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

async function fetchJson(url, fetchImpl, options = {}) {
  const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
  const controller =
    timeoutMs > 0 && typeof AbortController !== "undefined" ? new AbortController() : null;
  const method = String(options.method || "GET").trim().toUpperCase() || "GET";
  const body =
    options.body == null || typeof options.body === "string" || options.body instanceof Uint8Array
      ? options.body
      : JSON.stringify(options.body);
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };
  let timeoutHandle = null;

  if (controller && timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  let response = null;
  try {
    response = await fetchImpl(url, {
      method,
      headers,
      signal: controller?.signal,
      ...(body == null ? {} : { body }),
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다.");
    }
    throw error;
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function parseKisTokenExpiry(value = "", fallbackSeconds = 60 * 60 * 12) {
  const normalized = String(value || "").trim();
  if (normalized) {
    const timestampMatch = normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:\s|T)(\d{2}):(\d{2}):(\d{2})$/
    );
    const timestamp = timestampMatch
      ? Date.UTC(
          Number(timestampMatch[1]),
          Number(timestampMatch[2]) - 1,
          Number(timestampMatch[3]),
          Number(timestampMatch[4]) - 9,
          Number(timestampMatch[5]),
          Number(timestampMatch[6])
        )
      : new Date(normalized).getTime();
    if (Number.isFinite(timestamp)) {
      return timestamp;
    }
  }

  return Date.now() + fallbackSeconds * 1000;
}

async function resolveKisCredentials(rootDir) {
  return {
    appKey: String(await resolveEnvValue(rootDir, KIS_APP_KEY) || "").trim(),
    appSecret: String(await resolveEnvValue(rootDir, KIS_APP_SECRET) || "").trim(),
  };
}

function hasFreshKisAccessToken() {
  if (!kisAuthCache.token || !kisAuthCache.expiresAt) {
    return false;
  }

  return Date.now() + 60 * 1000 < kisAuthCache.expiresAt;
}

async function getKisAccessToken(rootDir, fetchImpl, credentials = null) {
  if (hasFreshKisAccessToken()) {
    return kisAuthCache.token;
  }

  if (kisAuthCache.inFlight) {
    return kisAuthCache.inFlight;
  }

  kisAuthCache.inFlight = (async () => {
    const { appKey, appSecret } = credentials || (await resolveKisCredentials(rootDir));
    if (!appKey || !appSecret) {
      throw new Error("국내주식 API 키가 설정되지 않았습니다.");
    }

    const payload = await fetchJson(`${KIS_API_BASE_URL}${KIS_ACCESS_TOKEN_URL}`, fetchImpl, {
      method: "POST",
      timeoutMs: REQUEST_TIMEOUTS.kisAuth,
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        grant_type: "client_credentials",
        appkey: appKey,
        appsecret: appSecret,
      },
    });

    const token = String(payload?.access_token || "").trim();
    if (!token) {
      throw new Error("국내주식 API 접근 토큰을 발급받지 못했습니다.");
    }

    kisAuthCache.token = token;
    kisAuthCache.expiresAt = parseKisTokenExpiry(payload?.access_token_token_expired, Number(payload?.expires_in) || 0);
    return token;
  })().finally(() => {
    kisAuthCache.inFlight = null;
  });

  return kisAuthCache.inFlight;
}

function parseKisDateTime(output = {}) {
  const date = String(output?.stck_bsop_date || output?.bsop_date || "").trim();
  const time = String(output?.stck_cntg_hour || output?.oprc_hour || "").trim();
  if (!/^\d{8}$/.test(date) || !/^\d{6}$/.test(time)) {
    return new Date().toISOString();
  }

  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(4, 6)) - 1;
  const day = Number(date.slice(6, 8));
  const hour = Number(time.slice(0, 2));
  const minute = Number(time.slice(2, 4));
  const second = Number(time.slice(4, 6));
  return new Date(Date.UTC(year, month, day, hour - 9, minute, second)).toISOString();
}

async function fetchKisStockQuote(rootDir, instrument, fetchImpl, credentials = null) {
  const { appKey, appSecret } = credentials || (await resolveKisCredentials(rootDir));
  const accessToken = await getKisAccessToken(rootDir, fetchImpl, {
    appKey,
    appSecret,
  });
  const url = new URL(`${KIS_API_BASE_URL}${KIS_DOMESTIC_STOCK_QUOTE_URL}`);
  url.searchParams.set("FID_COND_MRKT_DIV_CODE", "J");
  url.searchParams.set("FID_INPUT_ISCD", String(instrument.symbol || "").trim());

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.kisQuote,
    headers: {
      authorization: `Bearer ${accessToken}`,
      appkey: appKey,
      appsecret: appSecret,
      tr_id: "FHKST01010100",
      custtype: "P",
    },
  });

  if (String(payload?.rt_cd || "") !== "0") {
    throw new Error(payload?.msg1 || `${instrument.symbol} 국내주식 현재가 조회에 실패했습니다.`);
  }

  const output = payload?.output || {};
  const priceKrw = normalizeMoney(Number(output?.stck_prpr || 0));
  if (!Number.isFinite(priceKrw) || priceKrw <= 0) {
    throw new Error(`${instrument.symbol} 유효한 국내주식 가격을 받지 못했습니다.`);
  }

  const rawChangePercent = Number(output?.prdy_ctrt);
  const previousClose = normalizeMoney(Number(output?.stck_sdpr || 0));
  const changePercent = Number.isFinite(rawChangePercent)
    ? normalizeRate(rawChangePercent / 100)
    : Number.isFinite(previousClose) && previousClose > 0
      ? normalizeRate(priceKrw / previousClose - 1)
      : null;

  return {
    priceKrw,
    changePercent,
    isMarketOpen: isKrRegularMarketOpen(),
    updatedAt: parseKisDateTime(output),
  };
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

function getAllMajorIndexDefinitions() {
  return [...MAJOR_INDEX_GROUPS.korea, ...MAJOR_INDEX_GROUPS.us];
}

function createUnavailableIndexQuote(definition = {}, message = "지수 데이터를 불러오지 못했습니다.") {
  return {
    id: definition.id || "",
    label: definition.label || definition.id || "",
    symbol: definition.symbol || "",
    group: definition.group || "",
    tone: definition.tone || "neutral",
    value: null,
    changePercent: null,
    isMarketOpen: null,
    isDelayed: true,
    updatedAt: null,
    source: definition.source || "twelve-data",
    available: false,
    error: message,
  };
}

function hasAllCachedMajorIndices(indices = {}) {
  const expectedByGroup = {
    korea: new Set(MAJOR_INDEX_GROUPS.korea.map((item) => item.id)),
    us: new Set(MAJOR_INDEX_GROUPS.us.map((item) => item.id)),
  };

  return Object.entries(expectedByGroup).every(([group, expectedIds]) => {
    const items = Array.isArray(indices?.[group]) ? indices[group] : [];
    const actualIds = new Set(items.map((item) => String(item?.id || "").trim()));
    return [...expectedIds].every((id) => actualIds.has(id));
  });
}

function hasAllAvailableMajorIndices(indices = {}) {
  const expectedByGroup = {
    korea: new Set(MAJOR_INDEX_GROUPS.korea.map((item) => item.id)),
    us: new Set(MAJOR_INDEX_GROUPS.us.map((item) => item.id)),
  };

  return Object.entries(expectedByGroup).every(([group, expectedIds]) => {
    const items = Array.isArray(indices?.[group]) ? indices[group] : [];
    const availableIds = new Set(
      items
        .filter((item) => item?.available === true)
        .map((item) => String(item?.id || "").trim())
    );
    return [...expectedIds].every((id) => availableIds.has(id));
  });
}

function cloneMajorIndices(indices = createEmptyMajorIndexState(), options = {}) {
  const markDelayed = Boolean(options.markDelayed);
  return {
    korea: (Array.isArray(indices?.korea) ? indices.korea : []).map((item) => ({
      ...item,
      isDelayed: markDelayed ? true : Boolean(item?.isDelayed),
    })),
    us: (Array.isArray(indices?.us) ? indices.us : []).map((item) => ({
      ...item,
      isDelayed: markDelayed ? true : Boolean(item?.isDelayed),
    })),
  };
}

function createUnavailableMajorIndices(message = "지수 데이터를 불러오지 못했습니다.") {
  return {
    korea: MAJOR_INDEX_GROUPS.korea.map((definition) =>
      createUnavailableIndexQuote(
        {
          ...definition,
          group: "korea",
        },
        message
      )
    ),
    us: MAJOR_INDEX_GROUPS.us.map((definition) =>
      createUnavailableIndexQuote(
        {
          ...definition,
          group: "us",
        },
        message
      )
    ),
  };
}

function resolveMarketRefreshInterval(date = getCurrentDate()) {
  return isUsRegularMarketOpen(date) ? MARKET_REFRESH_INTERVAL_SECONDS : MARKET_CLOSED_REFRESH_INTERVAL_SECONDS;
}

function resolveMajorIndexRefreshInterval(indices = createEmptyMajorIndexState()) {
  const allIndices = [...(indices?.korea || []), ...(indices?.us || [])];
  const openIndex = allIndices.find((item) => item?.available && item?.isMarketOpen === true);
  if (openIndex) {
    return MAJOR_INDEX_OPEN_REFRESH_INTERVAL_SECONDS;
  }

  return MAJOR_INDEX_CLOSED_REFRESH_INTERVAL_SECONDS;
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

function isRetryBlocked(nextRetryAt) {
  if (!nextRetryAt) {
    return false;
  }

  const timestamp = new Date(nextRetryAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  return Date.now() < timestamp;
}

function hasAllCachedQuotes(cacheQuotes, instruments, options = {}) {
  const requireAvailable = Boolean(options.requireAvailable);
  return instruments.every((instrument) => {
    const cached = cacheQuotes[instrument.name];
    if (!cached) {
      return false;
    }

    if (requireAvailable && cached.available !== true) {
      return false;
    }

    return true;
  });
}

function hasOpenSessionCachedQuotes(cacheQuotes, instruments) {
  return instruments.some((instrument) => {
    const cached = cacheQuotes[instrument.name];
    return Boolean(cached && cached.available === true && cached.isMarketOpen === true);
  });
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

function hasAvailableQuotes(quotes = {}) {
  return Object.values(quotes).some((quote) => quote?.available === true);
}

function delay(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
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

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.upbit,
  });
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

async function fetchUpbitQuotesWithRetry(instruments, fetchImpl, options = {}) {
  const attempts = Math.max(1, Number(options.attempts) || 2);
  const retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 180);
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchUpbitQuotes(instruments, fetchImpl);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await delay(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError || new Error("업비트 현재가를 불러오지 못했습니다.");
}

function resolveBithumbTicker(instrument = {}) {
  const symbol = String(instrument.symbol || "").trim().toUpperCase();
  if (symbol.startsWith("KRW-") && symbol.length > 4) {
    return symbol.slice(4);
  }

  const normalizedName = String(instrument.name || instrument.asset || "")
    .trim()
    .toUpperCase();
  const nameMap = {
    BTC: "BTC",
    "비트코인": "BTC",
    ETH: "ETH",
    "이더리움": "ETH",
    XRP: "XRP",
    "엑스알피": "XRP",
    SOL: "SOL",
    "솔라나": "SOL",
    DOGE: "DOGE",
    "도지코인": "DOGE",
    ADA: "ADA",
    "에이다": "ADA",
    SUI: "SUI",
    "수이": "SUI",
    AVAX: "AVAX",
    "아발란체": "AVAX",
  };

  return nameMap[normalizedName] || "";
}

async function fetchBithumbSpotQuotes(instruments, fetchImpl) {
  const cryptoInstruments = instruments.filter((item) => item.market === "crypto");
  if (!cryptoInstruments.length) {
    return {};
  }

  const url = new URL("https://api.bithumb.com/public/ticker/ALL_KRW");
  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.bithumb,
  });

  if (String(payload?.status || "") !== "0000") {
    throw new Error(payload?.message || "빗썸 현재가를 불러오지 못했습니다.");
  }

  const tickers = payload?.data || {};
  const updatedAt = Number(tickers?.date)
    ? new Date(Number(tickers.date)).toISOString()
    : new Date().toISOString();

  return cryptoInstruments.reduce((quotes, instrument) => {
    const ticker = resolveBithumbTicker(instrument);
    if (!ticker) {
      return quotes;
    }

    const item = tickers[ticker];
    const priceKrw = normalizeMoney(Number(item?.closing_price || 0));
    if (!Number.isFinite(priceKrw) || priceKrw <= 0) {
      return quotes;
    }

    const rawChange = Number(item?.fluctate_rate_24H || item?.fluctate_rate || 0);
    quotes[instrument.name] = {
      ...instrument,
      available: true,
      price: priceKrw,
      priceKrw,
      priceUsd: null,
      changePercent: Number.isFinite(rawChange) ? normalizeRate(rawChange / 100) : null,
      isMarketOpen: true,
      isDelayed: false,
      updatedAt,
      error: null,
      source: "bithumb",
      localExchangePriceKrw: priceKrw,
    };
    return quotes;
  }, {});
}

async function fetchCoinGeckoSpotQuotes(instruments, fetchImpl) {
  const cryptoInstruments = instruments.filter((item) => item.market === "crypto");
  const ids = [...new Set(cryptoInstruments.map((item) => resolveCoinGeckoId(item)).filter(Boolean))];
  if (!ids.length) {
    return {};
  }

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", "krw,usd");
  url.searchParams.set("include_last_updated_at", "true");
  url.searchParams.set("include_24hr_change", "true");

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.coingeckoSpot,
  });
  return cryptoInstruments.reduce((quotes, instrument) => {
    const coinId = resolveCoinGeckoId(instrument);
    const item = coinId ? payload?.[coinId] : null;
    const priceKrw = normalizeMoney(Number(item?.krw || 0));
    const priceUsd = normalizeMoney(Number(item?.usd || 0));

    if (!item || !Number.isFinite(priceKrw) || priceKrw <= 0) {
      return quotes;
    }

    const rawChange =
      Number.isFinite(Number(item.krw_24h_change))
        ? Number(item.krw_24h_change)
        : Number.isFinite(Number(item.usd_24h_change))
          ? Number(item.usd_24h_change)
          : null;

    quotes[instrument.name] = {
      ...instrument,
      available: true,
      price: priceKrw,
      priceKrw,
      priceUsd: Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : null,
      changePercent: rawChange == null ? null : normalizeRate(rawChange / 100),
      isMarketOpen: true,
      isDelayed: false,
      updatedAt: item.last_updated_at
        ? new Date(Number(item.last_updated_at) * 1000).toISOString()
        : new Date().toISOString(),
      error: null,
      source: "coingecko",
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

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.coingeckoReference,
  });
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

    const localSource = String(quote.source || "").trim().toLowerCase();
    const localPriceKrw = Number(
      quote.upbitReferencePriceKrw ?? quote.localExchangePriceKrw ?? quote.priceKrw
    );
    const globalPriceKrw = Number(reference.globalPriceKrw);
    if (!Number.isFinite(localPriceKrw) || localPriceKrw <= 0 || !Number.isFinite(globalPriceKrw) || globalPriceKrw <= 0) {
      return;
    }

    quote.globalPriceKrw = reference.globalPriceKrw;
    quote.globalPriceUsd = reference.globalPriceUsd;
    quote.globalUpdatedAt = reference.globalUpdatedAt;
    const hasKoreanExchangeReference =
      Number.isFinite(Number(quote.upbitReferencePriceKrw)) ||
      Number.isFinite(Number(quote.localExchangePriceKrw)) ||
      localSource === "upbit" ||
      localSource === "bithumb";

    quote.kimchiPremiumPercent = hasKoreanExchangeReference
      ? normalizeRate(localPriceKrw / globalPriceKrw - 1)
      : null;
  });
}

async function resolveGlobalCryptoReferences(cryptoInstruments = [], fetchImpl, forceRefresh = false) {
  if (!cryptoInstruments.length) {
    return {};
  }

  const hasFreshCache =
    !forceRefresh &&
    isCacheFresh(livePriceCache.globalCrypto.updatedAt, GLOBAL_CRYPTO_REFRESH_INTERVAL_SECONDS) &&
    hasAllCachedQuotes(livePriceCache.globalCrypto.references, cryptoInstruments, { requireAvailable: false });
  if (hasFreshCache) {
    return pickCachedQuotes(livePriceCache.globalCrypto.references, cryptoInstruments);
  }

  if (!forceRefresh && isRetryBlocked(livePriceCache.globalCrypto.nextRetryAt)) {
    if (hasAllCachedQuotes(livePriceCache.globalCrypto.references, cryptoInstruments, { requireAvailable: false })) {
      return pickCachedQuotes(livePriceCache.globalCrypto.references, cryptoInstruments, true);
    }
    return {};
  }

  try {
    const references = await fetchCoinGeckoReferences(cryptoInstruments, fetchImpl);
    if (!Object.keys(references).length) {
      throw new Error("글로벌 기준 코인 가격이 비어 있습니다.");
    }

    livePriceCache.globalCrypto = {
      updatedAt: new Date().toISOString(),
      references,
      nextRetryAt: null,
    };
    return references;
  } catch (error) {
    livePriceCache.globalCrypto = {
      ...livePriceCache.globalCrypto,
      nextRetryAt: new Date(
        Date.now() + GLOBAL_CRYPTO_RETRY_COOLDOWN_SECONDS * 1000
      ).toISOString(),
    };
    if (hasAllCachedQuotes(livePriceCache.globalCrypto.references, cryptoInstruments, { requireAvailable: false })) {
      return pickCachedQuotes(livePriceCache.globalCrypto.references, cryptoInstruments, true);
    }
    return {};
  }
}

function getReusableCachedQuote(cacheQuotes = {}, instrument = {}, options = {}) {
  const cached = cacheQuotes[instrument.name];
  if (!cached || cached.available !== true) {
    return null;
  }
  const markDelayed = options.markDelayed !== false;

  return {
    ...cached,
    isDelayed: markDelayed ? true : Boolean(cached.isDelayed),
    error: null,
  };
}

async function fetchTwelveDataFxRate(apiKey, fetchImpl) {
  const url = new URL("https://api.twelvedata.com/currency_conversion");
  url.searchParams.set("symbol", "USD/KRW");
  url.searchParams.set("amount", "1");
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.twelveFx,
  });
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

function parsePositiveNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function parseTwelveMarketOpen(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "yes") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  return null;
}

function resolveTwelveQuotePrice(payload = {}, isMarketOpen = null) {
  const price = parsePositiveNumber(payload.price);
  const close = parsePositiveNumber(payload.close);
  const previousClose = parsePositiveNumber(payload.previous_close || payload.previousClose);

  if (isMarketOpen === true) {
    return price || close || previousClose || null;
  }

  // 장 종료 후에는 전/당일 정규장 종가를 우선 사용합니다.
  return close || previousClose || price || null;
}

async function fetchTwelveDataStockQuote(instrument, apiKey, fetchImpl) {
  const url = new URL("https://api.twelvedata.com/quote");
  url.searchParams.set("symbol", instrument.symbol);
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.twelveStock,
  });
  if (payload.status === "error") {
    throw new Error(payload.message || `${instrument.symbol} 현재가 조회에 실패했습니다.`);
  }

  const isMarketOpen = parseTwelveMarketOpen(payload.is_market_open);
  const priceUsd = resolveTwelveQuotePrice(payload, isMarketOpen);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error(`${instrument.symbol} 유효한 가격을 받지 못했습니다.`);
  }
  const rawPercentChange = Number(payload.percent_change);
  const previousClose = parsePositiveNumber(payload.previous_close || payload.previousClose);
  const changePercent = Number.isFinite(rawPercentChange)
    ? normalizeRate(rawPercentChange / 100)
    : Number.isFinite(previousClose) && previousClose > 0
      ? normalizeRate(priceUsd / previousClose - 1)
      : null;

  return {
    priceUsd: normalizeMoney(priceUsd),
    changePercent,
    isMarketOpen,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchYahooChart(symbol, params = {}, fetchImpl) {
  const url = new URL(`${encodeURIComponent(symbol)}`, YAHOO_CHART_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const payload = await fetchJson(url, fetchImpl, {
    timeoutMs: REQUEST_TIMEOUTS.yahooChart,
  });
  if (payload?.chart?.error) {
    throw new Error(payload.chart.error.description || "Yahoo Finance 응답 오류");
  }

  const result = payload?.chart?.result?.[0] || null;
  if (!result) {
    throw new Error("Yahoo Finance 시세 결과가 비어 있습니다.");
  }

  return result;
}

function getLastFiniteValue(values = []) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const numeric = Number(values[index]);
    if (Number.isFinite(numeric) && numeric > 0) {
      return numeric;
    }
  }

  return null;
}

async function fetchYahooFxRate(fetchImpl) {
  const result = await fetchYahooChart("KRW=X", { interval: "1d", range: "5d" }, fetchImpl);
  const quote = Array.isArray(result.indicators?.quote) ? result.indicators.quote[0] : null;
  const rawRate =
    Number(result.meta?.regularMarketPrice) ||
    Number(result.meta?.previousClose) ||
    getLastFiniteValue(Array.isArray(quote?.close) ? quote.close : []);

  if (!Number.isFinite(rawRate) || rawRate <= 0) {
    throw new Error("Yahoo Finance 환율 데이터를 읽지 못했습니다.");
  }

  const updatedAt = Number(result.meta?.regularMarketTime)
    ? new Date(Number(result.meta.regularMarketTime) * 1000).toISOString()
    : new Date().toISOString();

  return {
    usdkrw: normalizeMoney(rawRate),
    source: "yahoo-finance",
    updatedAt,
    isDelayed: true,
  };
}

async function fetchYahooStockQuote(instrument, fetchImpl) {
  const result = await fetchYahooChart(instrument.symbol, { interval: "1d", range: "5d" }, fetchImpl);
  const quote = Array.isArray(result.indicators?.quote) ? result.indicators.quote[0] : null;
  const priceUsd =
    Number(result.meta?.regularMarketPrice) ||
    Number(result.meta?.previousClose) ||
    getLastFiniteValue(Array.isArray(quote?.close) ? quote.close : []);

  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error(`${instrument.symbol} Yahoo Finance 가격을 읽지 못했습니다.`);
  }

  const previousClose =
    Number(result.meta?.chartPreviousClose) ||
    Number(result.meta?.previousClose) ||
    null;
  const changePercent =
    Number.isFinite(previousClose) && previousClose > 0 ? normalizeRate(priceUsd / previousClose - 1) : null;
  const regularPeriod = result.meta?.currentTradingPeriod?.regular || null;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const isMarketOpen =
    regularPeriod && Number.isFinite(Number(regularPeriod.start)) && Number.isFinite(Number(regularPeriod.end))
      ? nowSeconds >= Number(regularPeriod.start) && nowSeconds <= Number(regularPeriod.end)
      : null;
  const updatedAt = Number(result.meta?.regularMarketTime)
    ? new Date(Number(result.meta.regularMarketTime) * 1000).toISOString()
    : new Date().toISOString();

  return {
    priceUsd: normalizeMoney(priceUsd),
    changePercent,
    isMarketOpen,
    updatedAt,
  };
}

async function fetchTwelveDataMajorIndexQuote(definition = {}, apiKey = "", fetchImpl) {
  const symbolCandidates = [...new Set([definition.symbol, ...(definition.aliases || [])].filter(Boolean))];
  if (!symbolCandidates.length) {
    throw new Error("지수 심볼이 비어 있습니다.");
  }

  let lastError = null;
  for (const symbol of symbolCandidates) {
    try {
      const url = new URL("https://api.twelvedata.com/quote");
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("apikey", apiKey);

      const payload = await fetchJson(url, fetchImpl, {
        timeoutMs: REQUEST_TIMEOUTS.twelveStock,
      });
      if (payload?.status === "error") {
        throw new Error(payload.message || `${symbol} 지수 조회에 실패했습니다.`);
      }

      const isMarketOpen = parseTwelveMarketOpen(payload.is_market_open);
      const value = resolveTwelveQuotePrice(payload, isMarketOpen);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`${symbol} 지수 값을 읽지 못했습니다.`);
      }

      const rawChange = Number(payload.percent_change);
      return {
        id: definition.id || "",
        label: definition.label || definition.id || "",
        symbol: definition.symbol || symbol,
        group: definition.group || "",
        tone: definition.tone || "neutral",
        value: normalizeMoney(value),
        changePercent: Number.isFinite(rawChange) ? normalizeRate(rawChange / 100) : null,
        isMarketOpen,
        isDelayed: false,
        updatedAt: new Date().toISOString(),
        source: "twelve-data",
        available: true,
        error: null,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(`${definition.label || definition.symbol} 지수 조회에 실패했습니다.`);
}

async function fetchTwelveDataMajorIndices(apiKey = "", fetchImpl) {
  const groups = createEmptyMajorIndexState();
  const usItems = await Promise.all(
    MAJOR_INDEX_GROUPS.us.map(async (definition) => {
      try {
        return await fetchTwelveDataMajorIndexQuote(
          {
            ...definition,
            group: "us",
          },
          apiKey,
          fetchImpl
        );
      } catch (error) {
        return createUnavailableIndexQuote(
          {
            ...definition,
            group: "us",
          },
          error.message || "지수 데이터를 불러오지 못했습니다."
        );
      }
    })
  );

  groups.korea = [];
  groups.us = usItems;
  return groups;
}

function buildQuoteStatus(errors, warnings, quotes) {
  const availableCount = Object.values(quotes).filter((quote) => quote.available).length;
  const hasMissingKisKey = warnings.includes("missing-kis-api-key");
  const hasTwelveFallback = warnings.includes("market-fallback-provider");

  if (availableCount === 0 && errors.length) {
    return { level: "error", message: "실시간 가격을 불러오지 못했습니다." };
  }

  if (hasMissingKisKey && hasTwelveFallback) {
    return {
      level: availableCount > 0 ? "warning" : "error",
      message: "국내주식 API 키 필요 · 미국주식 지연 시세 반영 중",
    };
  }

  if (hasMissingKisKey) {
    return {
      level: availableCount > 0 ? "warning" : "error",
      message: availableCount > 0 ? "국내주식 API 키 필요 · 연결된 자산만 반영 중" : "국내주식 API 키 필요",
    };
  }

  if (warnings.includes("missing-twelve-data-key")) {
    return {
      level: availableCount > 0 ? "warning" : "error",
      message: availableCount > 0 ? "미국주식 API 키 필요 · 코인만 실시간 반영 중" : "미국주식 API 키 필요",
    };
  }

  if (warnings.includes("market-fallback-provider")) {
    return {
      level: "warning",
      message: "미국주식 지연 시세 반영 중",
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

function resolveQuoteForInstrument(quotes = {}, instrument = {}) {
  if (!quotes || typeof quotes !== "object") {
    return null;
  }

  const nameCandidates = [instrument.name, instrument.asset]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  for (const candidate of nameCandidates) {
    if (quotes[candidate]) {
      return quotes[candidate];
    }
  }

  const normalizedSymbol = String(instrument.symbol || "").trim().toUpperCase();
  if (!normalizedSymbol) {
    return null;
  }

  return (
    Object.values(quotes).find(
      (quote) => String(quote?.symbol || "").trim().toUpperCase() === normalizedSymbol
    ) || null
  );
}

function buildLiveHolding(holding, quotes) {
  const enriched = normalizeHoldingMetadata(holding);
  const quote = resolveQuoteForInstrument(quotes, enriched);
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
    pnl,
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
        liveQuote: resolveQuoteForInstrument(quotes, item) || createUnavailableQuote(item, "실시간 연결 준비 중"),
      })),
    })),
  };
}

async function buildMarketSnapshot({
  rootDir,
  instruments,
  fetchImpl,
  forceRefresh = false,
  allowCachedResponse = true,
}) {
  const usStockInstruments = instruments.filter((item) => item.market === "us-stock" && item.symbol);
  const krStockInstruments = instruments.filter((item) => item.market === "kr-stock" && item.symbol);
  const warnings = [];
  const errors = [];
  const marketQuotes = {};
  const nowDate = getCurrentDate();
  const usMarketOpenNow = usStockInstruments.length > 0 && isUsRegularMarketOpen(nowDate);
  const usTradingDayNow = usStockInstruments.length > 0 && isUsTradingDay(nowDate);
  const krMarketOpenNow = krStockInstruments.length > 0 && isKrRegularMarketOpen(nowDate);
  const krTradingDayNow = krStockInstruments.length > 0 && isKrTradingDay(nowDate);
  const marketRefreshIntervalSeconds =
    usMarketOpenNow || krMarketOpenNow
      ? MARKET_REFRESH_INTERVAL_SECONDS
      : MARKET_CLOSED_REFRESH_INTERVAL_SECONDS;
  const hasCachedUsStockQuotes = hasAllCachedQuotes(livePriceCache.market.quotes, usStockInstruments, {
    requireAvailable: true,
  });
  const hasCachedKrStockQuotes = hasAllCachedQuotes(livePriceCache.market.quotes, krStockInstruments, {
    requireAvailable: true,
  });
  const hasOpenSessionCachedUsStockQuotes = hasOpenSessionCachedQuotes(livePriceCache.market.quotes, usStockInstruments);
  const hasOpenSessionCachedKrStockQuotes = hasOpenSessionCachedQuotes(livePriceCache.market.quotes, krStockInstruments);
  const hasCachedFxRate = Number.isFinite(Number(livePriceCache.market.fx?.usdkrw)) && Number(livePriceCache.market.fx?.usdkrw) > 0;
  const usRegularSessionRefreshDue =
    usStockInstruments.length > 0 &&
    usMarketOpenNow &&
    (forceRefresh || !hasCachedUsStockQuotes || !isCacheFresh(livePriceCache.market.updatedAt, MARKET_REFRESH_INTERVAL_SECONDS));
  const usClosedSessionRefreshDue =
    usStockInstruments.length > 0 &&
    !usMarketOpenNow &&
    (!hasCachedUsStockQuotes ||
      hasOpenSessionCachedUsStockQuotes ||
      (usTradingDayNow &&
        (forceRefresh || shouldRefreshDaily(livePriceCache.market.updatedAt, US_MARKET_TIME_ZONE, nowDate))));
  const usStockRefreshDue = usRegularSessionRefreshDue || usClosedSessionRefreshDue;
  const krRegularSessionRefreshDue =
    krStockInstruments.length > 0 &&
    krMarketOpenNow &&
    (forceRefresh || !hasCachedKrStockQuotes || !isCacheFresh(livePriceCache.market.updatedAt, MARKET_REFRESH_INTERVAL_SECONDS));
  const krClosedSessionRefreshDue =
    krStockInstruments.length > 0 &&
    !krMarketOpenNow &&
    (!hasCachedKrStockQuotes ||
      hasOpenSessionCachedKrStockQuotes ||
      (krTradingDayNow &&
        (forceRefresh || shouldRefreshDaily(livePriceCache.market.updatedAt, KR_MARKET_TIME_ZONE, nowDate))));
  const krStockRefreshDue = krRegularSessionRefreshDue || krClosedSessionRefreshDue;
  const stockRefreshDue = usStockRefreshDue || krStockRefreshDue;
  const fxRefreshDue = !hasCachedFxRate || shouldRefreshDaily(livePriceCache.market.fx?.updatedAt, FX_REFRESH_TIME_ZONE, nowDate);
  const canServeCachedSnapshot = hasCachedFxRate && hasCachedUsStockQuotes && hasCachedKrStockQuotes;

  if (allowCachedResponse && canServeCachedSnapshot && !stockRefreshDue && !fxRefreshDue) {
    if (usStockInstruments.length) {
      Object.assign(marketQuotes, pickCachedQuotes(livePriceCache.market.quotes, usStockInstruments));
    }
    if (krStockInstruments.length) {
      Object.assign(marketQuotes, pickCachedQuotes(livePriceCache.market.quotes, krStockInstruments));
    }

    return {
      warnings,
      errors,
      marketQuotes,
      fx: cloneCachedFx(false),
      indices: createEmptyMajorIndexState(),
      marketRefreshIntervalSeconds,
    };
  }

  if (allowCachedResponse && canServeCachedSnapshot && !forceRefresh) {
    if (!livePriceCache.market.refreshInFlight) {
      livePriceCache.market.refreshInFlight = buildMarketSnapshot({
        rootDir,
        instruments,
        fetchImpl,
        forceRefresh: false,
        allowCachedResponse: false,
      })
        .catch(() => null)
        .finally(() => {
          livePriceCache.market.refreshInFlight = null;
        });
    }

    if (usStockInstruments.length) {
      Object.assign(marketQuotes, pickCachedQuotes(livePriceCache.market.quotes, usStockInstruments, usStockRefreshDue));
    }
    if (krStockInstruments.length) {
      Object.assign(marketQuotes, pickCachedQuotes(livePriceCache.market.quotes, krStockInstruments, krStockRefreshDue));
    }

    return {
      warnings,
      errors,
      marketQuotes,
      fx: cloneCachedFx(fxRefreshDue),
      indices: createEmptyMajorIndexState(),
      marketRefreshIntervalSeconds,
    };
  }

  const apiKey = String(await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY) || "").trim();
  const useFallbackProvider = !apiKey;
  const kisCredentials =
    krStockInstruments.length > 0
      ? await resolveKisCredentials(rootDir)
      : {
          appKey: "",
          appSecret: "",
        };
  const hasKisCredentials = Boolean(kisCredentials.appKey && kisCredentials.appSecret);
  const nextMarketUpdatedAt = getCurrentDate().toISOString();
  let fx = hasCachedFxRate ? cloneCachedFx(false) : { ...EMPTY_FX };
  const refreshedMarketQuotes = {};

  if (useFallbackProvider && usStockRefreshDue) {
    warnings.push("market-fallback-provider");
  }
  if (krStockInstruments.length > 0 && !hasKisCredentials) {
    warnings.push("missing-kis-api-key");
  }

  if (fxRefreshDue) {
    try {
      fx = useFallbackProvider ? await fetchYahooFxRate(fetchImpl) : await fetchTwelveDataFxRate(apiKey, fetchImpl);
      livePriceCache.market.fx = { ...fx };
    } catch (error) {
      errors.push(`fx:${error.message || "환율을 불러오지 못했습니다."}`);
      fx = hasCachedFxRate ? cloneCachedFx(true) : { ...EMPTY_FX };
    }
  }

  if (usStockRefreshDue) {
    const stockResults = await Promise.allSettled(
      usStockInstruments.map((instrument) =>
        useFallbackProvider
          ? fetchYahooStockQuote(instrument, fetchImpl)
          : fetchTwelveDataStockQuote(instrument, apiKey, fetchImpl)
      )
    );
    stockResults.forEach((result, index) => {
      const instrument = usStockInstruments[index];
      if (result.status === "fulfilled") {
        const nextQuote = decorateQuoteForDisplay(
          {
            ...instrument,
            available: true,
            price: result.value.priceUsd,
            priceUsd: result.value.priceUsd,
            priceKrw: null,
            changePercent: result.value.changePercent,
            isMarketOpen: result.value.isMarketOpen,
            isDelayed: useFallbackProvider,
            updatedAt: result.value.updatedAt,
            error: null,
          },
          fx.usdkrw
        );
        refreshedMarketQuotes[instrument.name] = nextQuote;
        return;
      }

      errors.push(`stock:${instrument.symbol}:${result.reason?.message || "현재가를 불러오지 못했습니다."}`);
      refreshedMarketQuotes[instrument.name] =
        getReusableCachedQuote(livePriceCache.market.quotes, instrument, { markDelayed: usMarketOpenNow }) ||
        createUnavailableQuote(instrument, "현재가를 불러오지 못했습니다.");
    });
  } else if (hasCachedUsStockQuotes) {
    Object.assign(marketQuotes, pickCachedQuotes(livePriceCache.market.quotes, usStockInstruments));
  } else if (usStockInstruments.length) {
    usStockInstruments.forEach((instrument) => {
      marketQuotes[instrument.name] = createUnavailableQuote(
        instrument,
        usMarketOpenNow ? "현재가를 불러오지 못했습니다." : "미국 정규장 시작 후 다시 갱신됩니다."
      );
    });
  }

  if (krStockRefreshDue) {
    if (!hasKisCredentials) {
      krStockInstruments.forEach((instrument) => {
        refreshedMarketQuotes[instrument.name] =
          getReusableCachedQuote(livePriceCache.market.quotes, instrument) ||
          createUnavailableQuote(instrument, "국내주식 API 키를 먼저 설정해주세요.");
      });
    } else {
      const stockResults = await Promise.allSettled(
        krStockInstruments.map((instrument) => fetchKisStockQuote(rootDir, instrument, fetchImpl, kisCredentials))
      );

      stockResults.forEach((result, index) => {
        const instrument = krStockInstruments[index];
        if (result.status === "fulfilled") {
          refreshedMarketQuotes[instrument.name] = {
            ...instrument,
            available: true,
            price: result.value.priceKrw,
            priceKrw: result.value.priceKrw,
            priceUsd: null,
            changePercent: result.value.changePercent,
            isMarketOpen: result.value.isMarketOpen,
            isDelayed: false,
            updatedAt: result.value.updatedAt,
            error: null,
          };
          return;
        }

        errors.push(`kr-stock:${instrument.symbol}:${result.reason?.message || "현재가를 불러오지 못했습니다."}`);
        refreshedMarketQuotes[instrument.name] =
          getReusableCachedQuote(livePriceCache.market.quotes, instrument, { markDelayed: krMarketOpenNow }) ||
          createUnavailableQuote(instrument, "현재가를 불러오지 못했습니다.");
      });
    }
  } else if (hasCachedKrStockQuotes) {
    Object.assign(marketQuotes, pickCachedQuotes(livePriceCache.market.quotes, krStockInstruments));
  } else if (krStockInstruments.length) {
    const noCredentialMessage = "국내주식 API 키를 먼저 설정해주세요.";
    const closedSessionMessage = "국내장 시작 후 다시 갱신됩니다.";
    krStockInstruments.forEach((instrument) => {
      marketQuotes[instrument.name] = createUnavailableQuote(
        instrument,
        hasKisCredentials ? (krMarketOpenNow ? "현재가를 불러오지 못했습니다." : closedSessionMessage) : noCredentialMessage
      );
    });
  }

  if (Object.keys(refreshedMarketQuotes).length) {
    Object.assign(marketQuotes, refreshedMarketQuotes);
  }

  if (Object.keys(refreshedMarketQuotes).length || fxRefreshDue) {
    livePriceCache.market = {
      ...livePriceCache.market,
      updatedAt: Object.keys(refreshedMarketQuotes).length ? nextMarketUpdatedAt : livePriceCache.market.updatedAt,
      quotes: {
        ...livePriceCache.market.quotes,
        ...refreshedMarketQuotes,
      },
      fx: { ...fx },
      indices: createEmptyMajorIndexState(),
      indicesUpdatedAt: null,
      indicesRefreshIntervalSeconds: MAJOR_INDEX_CLOSED_REFRESH_INTERVAL_SECONDS,
      refreshIntervalSeconds: marketRefreshIntervalSeconds,
      refreshInFlight: livePriceCache.market.refreshInFlight || null,
    };
  }

  return {
    warnings,
    errors,
    marketQuotes,
    fx,
    indices: createEmptyMajorIndexState(),
    marketRefreshIntervalSeconds,
  };
}

async function buildLivePriceSnapshot({ rootDir, fetchImpl = fetch, portfolioData = null, stateKey = "owner", forceRefresh = false }) {
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
  const cryptoInstruments = instruments.filter((item) => item.priceSource === "upbit" && item.symbol);
  const hasFreshCryptoCache =
    !forceRefresh &&
    isCacheFresh(livePriceCache.crypto.updatedAt, CRYPTO_REFRESH_INTERVAL_SECONDS) &&
    hasAllCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments);
  const marketSnapshotPromise = buildMarketSnapshot({
    rootDir,
    instruments,
    fetchImpl,
    forceRefresh,
  });

  if (!cryptoInstruments.length) {
    // A fresh onboarding board can have no crypto holdings or targets yet.
    // In that case, avoid calling Upbit just to turn an empty response into an error.
  } else if (hasFreshCryptoCache) {
    Object.assign(
      quotes,
      pickCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments)
    );
  } else {
    try {
      const normalizedCryptoQuotes = await fetchUpbitQuotesWithRetry(instruments, fetchImpl, {
        attempts: 2,
      }).then((cryptoQuotes) => {
        const normalizedQuotes = Object.fromEntries(
          Object.entries(cryptoQuotes).map(([name, quote]) => [
            name,
            {
              ...quote,
              source: "upbit",
              localExchangePriceKrw:
                Number.isFinite(Number(quote.priceKrw)) && Number(quote.priceKrw) > 0
                  ? normalizeMoney(Number(quote.priceKrw))
                  : null,
            },
          ])
        );
        if (!hasAvailableQuotes(normalizedQuotes)) {
          throw new Error("업비트 응답에 유효한 코인 가격이 없습니다.");
        }
        return normalizedQuotes;
      });
      livePriceCache.crypto = {
        updatedAt: new Date().toISOString(),
        quotes: normalizedCryptoQuotes,
      };
      Object.assign(quotes, normalizedCryptoQuotes);
    } catch (error) {
      errors.push(`crypto:${error.message || "업비트 가격을 불러오지 못했습니다."}`);
      if (hasAllCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments)) {
        Object.assign(
          quotes,
          pickCachedQuotes(livePriceCache.crypto.quotes, cryptoInstruments, true)
        );
      } else {
        cryptoInstruments.forEach((instrument) => {
          quotes[instrument.name] = createUnavailableQuote(instrument, "업비트 가격을 불러오지 못했습니다.");
        });
      }
    }
  }

  const marketSnapshot = await marketSnapshotPromise;
  Object.assign(quotes, marketSnapshot.marketQuotes || {});
  errors.push(...(marketSnapshot.errors || []));
  warnings.push(...(marketSnapshot.warnings || []));
  const fx = marketSnapshot.fx || { ...EMPTY_FX };
  const indices = marketSnapshot.indices || createEmptyMajorIndexState();
  const marketRefreshIntervalSeconds =
    marketSnapshot.marketRefreshIntervalSeconds || MARKET_REFRESH_INTERVAL_SECONDS;
  const globalCryptoReferences = await resolveGlobalCryptoReferences(
    cryptoInstruments,
    fetchImpl,
    forceRefresh
  );
  applyKimchiPremiumToQuotes(quotes, globalCryptoReferences);

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
    indices,
    portfolioLive: {
      stateRevision: Number(portfolio.metadata?.stateRevision || 0),
      lastMutationAt: portfolio.metadata?.lastMutationAt || null,
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
