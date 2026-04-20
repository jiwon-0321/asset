const fs = require("fs/promises");
const path = require("path");
const { readLocalEnvFiles } = require("./env-file");

const TWELVE_DATA_API_KEY = "TWELVE_DATA_API_KEY";
const YAHOO_CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/";
const DAY_CHART_RANGE_CONFIG = Object.freeze({
  "1W": {
    label: "1주",
    cryptoCount: 7,
    usStockCount: 7,
  },
  "1M": {
    label: "1개월",
    cryptoCount: 30,
    usStockCount: 30,
  },
  "1Y": {
    label: "1년",
    cryptoCount: 365,
    usStockCount: 260,
  },
});

const MINUTE_CHART_RANGE_CONFIG = Object.freeze({
  "1D": {
    label: "1일",
    cryptoUnit: 15,
    cryptoCount: 96,
    usStockInterval: "15min",
    usStockCount: 96,
    sourceLabel: "15분봉",
  },
  "1W": {
    label: "1주",
    cryptoUnit: 60,
    cryptoCount: 168,
    usStockInterval: "1h",
    usStockCount: 168,
    sourceLabel: "1시간봉",
  },
  "1M": {
    label: "1개월",
    cryptoUnit: 240,
    cryptoCount: 180,
    usStockInterval: "4h",
    usStockCount: 180,
    sourceLabel: "4시간봉",
  },
});

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

async function fetchJson(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`차트 데이터를 불러오지 못했습니다. (${response.status})`);
  }

  return response.json();
}

async function fetchYahooChart(symbol, params = {}, fetchImpl = fetch) {
  const url = new URL(`${encodeURIComponent(symbol)}`, YAHOO_CHART_BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  url.searchParams.set("includePrePost", "false");
  url.searchParams.set("events", "div,splits");

  const payload = await fetchJson(url, fetchImpl);
  if (payload?.chart?.error) {
    throw new Error(payload.chart.error.description || "Yahoo Finance 차트 응답 오류");
  }

  const result = payload?.chart?.result?.[0] || null;
  if (!result) {
    throw new Error("Yahoo Finance 차트 결과가 비어 있습니다.");
  }

  return result;
}

function mapYahooChartPoints(result, { includeTime = false } = {}) {
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : [];
  const quote = Array.isArray(result?.indicators?.quote) ? result.indicators.quote[0] : null;
  const opens = Array.isArray(quote?.open) ? quote.open : [];
  const highs = Array.isArray(quote?.high) ? quote.high : [];
  const lows = Array.isArray(quote?.low) ? quote.low : [];
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const volumes = Array.isArray(quote?.volume) ? quote.volume : [];

  return timestamps
    .map((timestamp, index) => {
      const close = Number(closes[index]);
      const open = Number(opens[index]);
      const high = Number(highs[index]);
      const low = Number(lows[index]);
      if (![close, open, high, low].some((value) => Number.isFinite(value))) {
        return null;
      }

      const date = new Date(Number(timestamp) * 1000);
      const iso = date.toISOString();
      return {
        timestamp: iso,
        label: normalizePointLabel(iso, "ko-KR", { includeTime }),
        open: Number.isFinite(open) ? open : close,
        high: Number.isFinite(high) ? high : close,
        low: Number.isFinite(low) ? low : close,
        close: Number.isFinite(close) ? close : open,
        volume: Number.isFinite(Number(volumes[index])) ? Number(volumes[index]) : 0,
      };
    })
    .filter(Boolean);
}

function normalizePointLabel(value, locale = "ko-KR", options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value || "");
  }

  return new Intl.DateTimeFormat(locale, {
    month: "2-digit",
    day: "2-digit",
    ...(options.includeTime
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }
      : {}),
  }).format(date);
}

function buildSummary(points = []) {
  if (!points.length) {
    return {
      latest: null,
      changeAmount: 0,
      changePercent: 0,
      updatedAt: null,
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const latest = Number(last.close || 0);
  const firstClose = Number(first.close || 0);
  const changeAmount = latest - firstClose;
  const changePercent = firstClose ? changeAmount / firstClose : 0;

  return {
    latest,
    changeAmount,
    changePercent,
    updatedAt: last.timestamp || null,
  };
}

function resolveChartRange(range) {
  return DAY_CHART_RANGE_CONFIG[String(range || "1M").trim().toUpperCase()] || DAY_CHART_RANGE_CONFIG["1M"];
}

function resolveMinuteChartRange(range) {
  return MINUTE_CHART_RANGE_CONFIG[String(range || "1D").trim().toUpperCase()] || MINUTE_CHART_RANGE_CONFIG["1D"];
}

async function fetchCryptoDayChart(symbol, range, fetchImpl = fetch) {
  const rangeConfig = resolveChartRange(range);
  const url = new URL("https://api.upbit.com/v1/candles/days");
  url.searchParams.set("market", symbol);
  url.searchParams.set("count", String(rangeConfig.cryptoCount));

  const payload = await fetchJson(url, fetchImpl);
  const points = (Array.isArray(payload) ? payload : [])
    .map((item) => ({
      timestamp: item.candle_date_time_kst || item.candle_date_time_utc,
      label: normalizePointLabel(item.candle_date_time_kst || item.candle_date_time_utc),
      open: Number(item.opening_price || 0),
      high: Number(item.high_price || 0),
      low: Number(item.low_price || 0),
      close: Number(item.trade_price || 0),
      volume: Number(item.candle_acc_trade_volume || 0),
    }))
    .reverse();

  return {
    rangeKey: String(range || "1M").trim().toUpperCase() || "1M",
    rangeLabel: `최근 ${rangeConfig.label}`,
    sourceLabel: "업비트 일봉",
    points,
    summary: buildSummary(points),
  };
}

async function fetchCryptoMinuteChart(symbol, range, fetchImpl = fetch) {
  const rangeConfig = resolveMinuteChartRange(range);
  const url = new URL(`https://api.upbit.com/v1/candles/minutes/${rangeConfig.cryptoUnit}`);
  url.searchParams.set("market", symbol);
  url.searchParams.set("count", String(rangeConfig.cryptoCount));

  const payload = await fetchJson(url, fetchImpl);
  const points = (Array.isArray(payload) ? payload : [])
    .map((item) => ({
      timestamp: item.candle_date_time_kst || item.candle_date_time_utc,
      label: normalizePointLabel(item.candle_date_time_kst || item.candle_date_time_utc, "ko-KR", { includeTime: true }),
      open: Number(item.opening_price || 0),
      high: Number(item.high_price || 0),
      low: Number(item.low_price || 0),
      close: Number(item.trade_price || 0),
      volume: Number(item.candle_acc_trade_volume || 0),
    }))
    .reverse();

  return {
    rangeKey: String(range || "1D").trim().toUpperCase() || "1D",
    rangeLabel: `최근 ${rangeConfig.label}`,
    sourceLabel: `업비트 ${rangeConfig.sourceLabel}`,
    points,
    summary: buildSummary(points),
  };
}

async function fetchUsStockDayChart(rootDir, symbol, range, fetchImpl = fetch) {
  const rangeConfig = resolveChartRange(range);
  const apiKey = await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY);
  if (!apiKey) {
    const yahooRange = range === "1W" ? "5d" : range === "1Y" ? "1y" : "1mo";
    const result = await fetchYahooChart(symbol, { interval: "1d", range: yahooRange }, fetchImpl);
    const points = mapYahooChartPoints(result);

    return {
      rangeKey: String(range || "1M").trim().toUpperCase() || "1M",
      rangeLabel: `최근 ${rangeConfig.label}`,
      sourceLabel: "Yahoo Finance 일봉",
      points,
      summary: buildSummary(points),
    };
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("outputsize", String(rangeConfig.usStockCount));
  url.searchParams.set("timezone", "Asia/Seoul");
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl);
  if (payload?.status === "error") {
    throw new Error(payload?.message || "미국주식 차트를 불러오지 못했습니다.");
  }

  const points = (Array.isArray(payload?.values) ? payload.values : [])
    .map((item) => ({
      timestamp: item.datetime,
      label: normalizePointLabel(item.datetime),
      open: Number(item.open || 0),
      high: Number(item.high || 0),
      low: Number(item.low || 0),
      close: Number(item.close || 0),
      volume: Number(item.volume || 0),
    }))
    .reverse();

  return {
    rangeKey: String(range || "1M").trim().toUpperCase() || "1M",
    rangeLabel: `최근 ${rangeConfig.label}`,
    sourceLabel: "Twelve Data 일봉",
    points,
    summary: buildSummary(points),
  };
}

async function fetchUsStockMinuteChart(rootDir, symbol, range, fetchImpl = fetch) {
  const rangeConfig = resolveMinuteChartRange(range);
  const apiKey = await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY);
  if (!apiKey) {
    const yahooParams =
      String(range || "1D").trim().toUpperCase() === "1D"
        ? { interval: "15m", range: "1d" }
        : String(range || "1D").trim().toUpperCase() === "1W"
          ? { interval: "60m", range: "5d" }
          : { interval: "60m", range: "1mo" };
    const result = await fetchYahooChart(symbol, yahooParams, fetchImpl);
    const points = mapYahooChartPoints(result, { includeTime: true });

    return {
      rangeKey: String(range || "1D").trim().toUpperCase() || "1D",
      rangeLabel: `최근 ${rangeConfig.label}`,
      sourceLabel: `Yahoo Finance ${rangeConfig.sourceLabel}`,
      points,
      summary: buildSummary(points),
    };
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", rangeConfig.usStockInterval);
  url.searchParams.set("outputsize", String(rangeConfig.usStockCount));
  url.searchParams.set("timezone", "Asia/Seoul");
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl);
  if (payload?.status === "error") {
    throw new Error(payload?.message || "미국주식 분봉을 불러오지 못했습니다.");
  }

  const points = (Array.isArray(payload?.values) ? payload.values : [])
    .map((item) => ({
      timestamp: item.datetime,
      label: normalizePointLabel(item.datetime, "ko-KR", { includeTime: true }),
      open: Number(item.open || 0),
      high: Number(item.high || 0),
      low: Number(item.low || 0),
      close: Number(item.close || 0),
      volume: Number(item.volume || 0),
    }))
    .reverse();

  return {
    rangeKey: String(range || "1D").trim().toUpperCase() || "1D",
    rangeLabel: `최근 ${rangeConfig.label}`,
    sourceLabel: `Twelve Data ${rangeConfig.sourceLabel}`,
    points,
    summary: buildSummary(points),
  };
}

function resolveUsMajorIndexSymbol(symbol = "") {
  const normalized = String(symbol || "").trim().toUpperCase();
  const mappings = {
    QQQ: "QQQ",
    IXIC: "QQQ",
    "^IXIC": "QQQ",
    SPY: "SPY",
    GSPC: "SPY",
    "^GSPC": "SPY",
    SPX: "SPY",
    DIA: "DIA",
    DJI: "DIA",
    "^DJI": "DIA",
    DJIA: "DIA",
  };
  return mappings[normalized] || "";
}

async function fetchMajorIndexDayChart(rootDir, symbol, range, fetchImpl = fetch) {
  const rangeConfig = resolveChartRange(range);
  const normalizedRange = String(range || "1M").trim().toUpperCase() || "1M";
  const normalizedSymbol = resolveUsMajorIndexSymbol(symbol);
  if (!normalizedSymbol) {
    throw new Error("국내 지수 차트는 국내주식 API 연결 단계에서 지원합니다.");
  }

  const apiKey = await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY);
  if (!apiKey) {
    throw new Error("미국 지수 차트 API 키가 필요합니다.");
  }

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", normalizedSymbol);
  url.searchParams.set("interval", "1day");
  url.searchParams.set("outputsize", String(rangeConfig.usStockCount));
  url.searchParams.set("timezone", "Asia/Seoul");
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl);
  if (payload?.status === "error") {
    throw new Error(payload?.message || "미국 지수 차트를 불러오지 못했습니다.");
  }

  const points = (Array.isArray(payload?.values) ? payload.values : [])
    .map((item) => ({
      timestamp: item.datetime,
      label: normalizePointLabel(item.datetime),
      open: Number(item.open || 0),
      high: Number(item.high || 0),
      low: Number(item.low || 0),
      close: Number(item.close || 0),
      volume: Number(item.volume || 0),
    }))
    .reverse();

  return {
    rangeKey: normalizedRange,
    rangeLabel: `최근 ${rangeConfig.label}`,
    sourceLabel: "Twelve Data 지수 일봉",
    points,
    summary: buildSummary(points),
  };
}

function resolveFxSymbol(symbol = "") {
  const normalized = String(symbol || "").trim().toUpperCase();
  const mappings = {
    "KRW=X": "USDKRW",
    USDKRW: "USDKRW",
    "USD/KRW": "USDKRW",
  };
  return mappings[normalized] || "";
}

async function fetchFxDayChart(rootDir, symbol, range, fetchImpl = fetch) {
  const rangeConfig = resolveChartRange(range);
  const normalizedRange = String(range || "1M").trim().toUpperCase() || "1M";
  const normalizedSymbol = resolveFxSymbol(symbol);
  if (!normalizedSymbol) {
    throw new Error("환율 차트 심볼이 유효하지 않습니다.");
  }

  const apiKey = await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY);
  if (!apiKey) {
    throw new Error("환율 차트 API 키가 필요합니다.");
  }

  const symbolCandidates = [...new Set([normalizedSymbol, "USDKRW", "USD/KRW", "USDKRW:FOREX", "USD/KRW:FOREX"])];
  let lastError = null;

  for (const candidateSymbol of symbolCandidates) {
    try {
      const url = new URL("https://api.twelvedata.com/time_series");
      url.searchParams.set("symbol", candidateSymbol);
      url.searchParams.set("interval", "1day");
      url.searchParams.set("outputsize", String(rangeConfig.cryptoCount));
      url.searchParams.set("timezone", "Asia/Seoul");
      url.searchParams.set("apikey", apiKey);

      const payload = await fetchJson(url, fetchImpl);
      if (payload?.status === "error") {
        lastError = new Error(payload?.message || "환율 차트를 불러오지 못했습니다.");
        continue;
      }

      const points = (Array.isArray(payload?.values) ? payload.values : [])
        .map((item) => ({
          timestamp: item.datetime,
          label: normalizePointLabel(item.datetime),
          open: Number(item.open || 0),
          high: Number(item.high || 0),
          low: Number(item.low || 0),
          close: Number(item.close || 0),
          volume: Number(item.volume || 0),
        }))
        .reverse();

      if (!points.length) {
        continue;
      }

      return {
        rangeKey: normalizedRange,
        rangeLabel: `최근 ${rangeConfig.label}`,
        sourceLabel: "Twelve Data 환율 일봉",
        points,
        summary: buildSummary(points),
      };
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const snapshotUrl = new URL("https://api.twelvedata.com/exchange_rate");
    snapshotUrl.searchParams.set("symbol", "USD/KRW");
    snapshotUrl.searchParams.set("apikey", apiKey);
    const snapshotPayload = await fetchJson(snapshotUrl, fetchImpl);
    if (snapshotPayload?.status === "error") {
      throw new Error(snapshotPayload?.message || "환율 스냅샷을 불러오지 못했습니다.");
    }

    const rate = Number(snapshotPayload?.rate || snapshotPayload?.price || snapshotPayload?.close || 0);
    if (!(rate > 0)) {
      throw new Error("환율 스냅샷 값이 유효하지 않습니다.");
    }

    const pointCount = Math.max(7, Number(rangeConfig.cryptoCount || 30));
    const points = [];
    for (let offset = pointCount - 1; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      const isoDate = date.toISOString().slice(0, 10);
      points.push({
        timestamp: isoDate,
        label: normalizePointLabel(isoDate),
        open: rate,
        high: rate,
        low: rate,
        close: rate,
        volume: 0,
      });
    }

    return {
      rangeKey: normalizedRange,
      rangeLabel: `최근 ${rangeConfig.label}`,
      sourceLabel: "Twelve Data 환율 스냅샷",
      points,
      summary: buildSummary(points),
    };
  } catch (error) {
    lastError = lastError || error;
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error("환율 차트를 불러오지 못했습니다.");
}

async function buildAssetChartSnapshot({ rootDir, market, symbol, name, range = "1M", granularity = "day", fetchImpl = fetch }) {
  const normalizedMarket = String(market || "").trim();
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const normalizedName = String(name || symbol || "").trim();
  const normalizedRange = String(range || "1M").trim().toUpperCase() || "1M";
  const requestedGranularity = String(granularity || "day").trim().toLowerCase() === "minute" ? "minute" : "day";
  const normalizedGranularity =
    normalizedMarket === "major-index" || normalizedMarket === "fx" ? "day" : requestedGranularity;

  if (!normalizedMarket || !normalizedSymbol) {
    throw new Error("차트 요청 정보가 부족합니다.");
  }

  if (normalizedMarket === "kr-stock") {
    throw new Error("국내주식 차트는 다음 단계에서 연결할 예정입니다.");
  }

  const chart =
    normalizedMarket === "major-index"
      ? await fetchMajorIndexDayChart(rootDir, normalizedSymbol, normalizedRange, fetchImpl)
      : normalizedMarket === "fx"
        ? await fetchFxDayChart(rootDir, normalizedSymbol, normalizedRange, fetchImpl)
      : normalizedMarket === "crypto"
      ? normalizedGranularity === "minute"
        ? await fetchCryptoMinuteChart(normalizedSymbol, normalizedRange, fetchImpl)
        : await fetchCryptoDayChart(normalizedSymbol, normalizedRange, fetchImpl)
      : normalizedGranularity === "minute"
        ? await fetchUsStockMinuteChart(rootDir, normalizedSymbol, normalizedRange, fetchImpl)
        : await fetchUsStockDayChart(rootDir, normalizedSymbol, normalizedRange, fetchImpl);

  return {
    instrument: {
      market: normalizedMarket,
      symbol: normalizedSymbol,
      name: normalizedName,
    },
    granularity: normalizedGranularity,
    ...chart,
  };
}

module.exports = {
  buildAssetChartSnapshot,
};
