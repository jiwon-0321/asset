const fs = require("fs/promises");
const path = require("path");

const TWELVE_DATA_API_KEY = "TWELVE_DATA_API_KEY";
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
    throw new Error("미국주식 차트 API 키가 없습니다.");
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
    throw new Error("미국주식 차트 API 키가 없습니다.");
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

async function buildAssetChartSnapshot({ rootDir, market, symbol, name, range = "1M", granularity = "day", fetchImpl = fetch }) {
  const normalizedMarket = String(market || "").trim();
  const normalizedSymbol = String(symbol || "").trim().toUpperCase();
  const normalizedName = String(name || symbol || "").trim();
  const normalizedRange = String(range || "1M").trim().toUpperCase() || "1M";
  const normalizedGranularity = String(granularity || "day").trim().toLowerCase() === "minute" ? "minute" : "day";

  if (!normalizedMarket || !normalizedSymbol) {
    throw new Error("차트 요청 정보가 부족합니다.");
  }

  if (normalizedMarket === "kr-stock") {
    throw new Error("국내주식 차트는 다음 단계에서 연결할 예정입니다.");
  }

  const chart =
    normalizedMarket === "crypto"
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
