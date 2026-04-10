const fs = require("fs/promises");
const path = require("path");

const TWELVE_DATA_API_KEY = "TWELVE_DATA_API_KEY";
const UPBIT_MARKET_ALL_URL = "https://api.upbit.com/v1/market/all?isDetails=false";
const KRX_CORP_LIST_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13";
const SEARCH_RESULT_LIMIT = 12;
const UPBIT_CACHE_TTL = 1000 * 60 * 60 * 12;
const KRX_CACHE_TTL = 1000 * 60 * 60 * 12;

const cacheStore = {
  cryptoCatalog: {
    expiresAt: 0,
    items: [],
  },
  krStockCatalog: {
    expiresAt: 0,
    items: [],
  },
};

const US_STOCK_SEED_CATALOG = Object.freeze([
  {
    market: "미국주식",
    value: "Palantir Technologies Inc. (PLTR)",
    title: "Palantir Technologies Inc. (PLTR)",
    meta: "미국주식 티커",
    symbol: "PLTR",
    aliases: ["palantir", "pltr", "팔란티어"],
  },
  {
    market: "미국주식",
    value: "Circle Internet Group, Inc. (CRCL)",
    title: "Circle Internet Group, Inc. (CRCL)",
    meta: "미국주식 티커",
    symbol: "CRCL",
    aliases: ["circle", "crcl", "써클"],
  },
  {
    market: "미국주식",
    value: "Apple Inc. (AAPL)",
    title: "Apple Inc. (AAPL)",
    meta: "미국주식 티커",
    symbol: "AAPL",
    aliases: ["apple", "aapl", "애플"],
  },
  {
    market: "미국주식",
    value: "NVIDIA Corporation (NVDA)",
    title: "NVIDIA Corporation (NVDA)",
    meta: "미국주식 티커",
    symbol: "NVDA",
    aliases: ["nvidia", "nvda", "엔비디아"],
  },
  {
    market: "미국주식",
    value: "Tesla, Inc. (TSLA)",
    title: "Tesla, Inc. (TSLA)",
    meta: "미국주식 티커",
    symbol: "TSLA",
    aliases: ["tesla", "tsla", "테슬라"],
  },
  {
    market: "미국주식",
    value: "Microsoft Corporation (MSFT)",
    title: "Microsoft Corporation (MSFT)",
    meta: "미국주식 티커",
    symbol: "MSFT",
    aliases: ["microsoft", "msft", "마이크로소프트"],
  },
  {
    market: "미국주식",
    value: "Amazon.com, Inc. (AMZN)",
    title: "Amazon.com, Inc. (AMZN)",
    meta: "미국주식 티커",
    symbol: "AMZN",
    aliases: ["amazon", "amzn", "아마존"],
  },
  {
    market: "미국주식",
    value: "Alphabet Inc. Class A (GOOGL)",
    title: "Alphabet Inc. Class A (GOOGL)",
    meta: "미국주식 티커",
    symbol: "GOOGL",
    aliases: ["alphabet", "google", "googl", "알파벳", "구글"],
  },
  {
    market: "미국주식",
    value: "Alphabet Inc. Class C (GOOG)",
    title: "Alphabet Inc. Class C (GOOG)",
    meta: "미국주식 티커",
    symbol: "GOOG",
    aliases: ["alphabet", "google", "goog", "알파벳", "구글"],
  },
  {
    market: "미국주식",
    value: "Advanced Micro Devices, Inc. (AMD)",
    title: "Advanced Micro Devices, Inc. (AMD)",
    meta: "미국주식 티커",
    symbol: "AMD",
    aliases: ["amd", "advanced micro devices", "에이엠디"],
  },
  {
    market: "미국주식",
    value: "Broadcom Inc. (AVGO)",
    title: "Broadcom Inc. (AVGO)",
    meta: "미국주식 티커",
    symbol: "AVGO",
    aliases: ["broadcom", "avgo", "브로드컴"],
  },
  {
    market: "미국주식",
    value: "Coinbase Global, Inc. (COIN)",
    title: "Coinbase Global, Inc. (COIN)",
    meta: "미국주식 티커",
    symbol: "COIN",
    aliases: ["coinbase", "coin", "코인베이스"],
  },
  {
    market: "미국주식",
    value: "Netflix, Inc. (NFLX)",
    title: "Netflix, Inc. (NFLX)",
    meta: "미국주식 티커",
    symbol: "NFLX",
    aliases: ["netflix", "nflx", "넷플릭스"],
  },
  {
    market: "미국주식",
    value: "Snowflake Inc. (SNOW)",
    title: "Snowflake Inc. (SNOW)",
    meta: "미국주식 티커",
    symbol: "SNOW",
    aliases: ["snowflake", "snow", "스노우플레이크", "스노우"],
  },
  {
    market: "미국주식",
    value: "Oracle Corporation (ORCL)",
    title: "Oracle Corporation (ORCL)",
    meta: "미국주식 티커",
    symbol: "ORCL",
    aliases: ["oracle", "orcl", "ora", "오라클"],
  },
  {
    market: "미국주식",
    value: "Uber Technologies, Inc. (UBER)",
    title: "Uber Technologies, Inc. (UBER)",
    meta: "미국주식 티커",
    symbol: "UBER",
    aliases: ["uber", "우버"],
  },
  {
    market: "미국주식",
    value: "Adobe Inc. (ADBE)",
    title: "Adobe Inc. (ADBE)",
    meta: "미국주식 티커",
    symbol: "ADBE",
    aliases: ["adobe", "adbe", "어도비"],
  },
  {
    market: "미국주식",
    value: "Salesforce, Inc. (CRM)",
    title: "Salesforce, Inc. (CRM)",
    meta: "미국주식 티커",
    symbol: "CRM",
    aliases: ["salesforce", "crm", "세일즈포스"],
  },
  {
    market: "미국주식",
    value: "Taiwan Semiconductor Manufacturing Company Limited (TSM)",
    title: "Taiwan Semiconductor Manufacturing Company Limited (TSM)",
    meta: "미국주식 티커",
    symbol: "TSM",
    aliases: ["tsmc", "tsm", "taiwan semiconductor", "대만반도체"],
  },
  {
    market: "미국주식",
    value: "Arm Holdings plc American Depositary Shares (ARM)",
    title: "Arm Holdings plc American Depositary Shares (ARM)",
    meta: "미국주식 티커",
    symbol: "ARM",
    aliases: ["arm", "암", "암홀딩스"],
  },
  {
    market: "미국주식",
    value: "Palo Alto Networks, Inc. (PANW)",
    title: "Palo Alto Networks, Inc. (PANW)",
    meta: "미국주식 티커",
    symbol: "PANW",
    aliases: ["palo alto", "panw", "팔로알토"],
  },
  {
    market: "미국주식",
    value: "CrowdStrike Holdings, Inc. (CRWD)",
    title: "CrowdStrike Holdings, Inc. (CRWD)",
    meta: "미국주식 티커",
    symbol: "CRWD",
    aliases: ["crowdstrike", "crwd", "크라우드스트라이크"],
  },
  {
    market: "미국주식",
    value: "Robinhood Markets, Inc. (HOOD)",
    title: "Robinhood Markets, Inc. (HOOD)",
    meta: "미국주식 티커",
    symbol: "HOOD",
    aliases: ["robinhood", "hood", "로빈후드"],
  },
  {
    market: "미국주식",
    value: "SoFi Technologies, Inc. (SOFI)",
    title: "SoFi Technologies, Inc. (SOFI)",
    meta: "미국주식 티커",
    symbol: "SOFI",
    aliases: ["sofi", "소파이"],
  },
]);

function normalizeToken(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s.,/#!$%^&*;:{}=\-_`~()[\]<>+]/g, "");
}

function decodeHtmlEntities(value = "") {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(value = "") {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

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

function scoreSuggestion(item, normalizedQuery) {
  const aliases = [...new Set([item.value, item.title, item.symbol, ...(item.aliases || [])].filter(Boolean))];
  const aliasTokens = aliases.map((entry) => normalizeToken(entry)).filter(Boolean);
  const exactMatch = aliasTokens.some((token) => token === normalizedQuery);
  const prefixMatch = aliasTokens.some((token) => token.startsWith(normalizedQuery));
  const includesMatch = aliasTokens.some((token) => token.includes(normalizedQuery));

  if (!exactMatch && !prefixMatch && !includesMatch) {
    return null;
  }

  return {
    ...item,
    score: exactMatch ? 0 : prefixMatch ? 1 : 2,
  };
}

function rankSuggestions(items, query) {
  const normalizedQuery = normalizeToken(query);
  if (!normalizedQuery) {
    return [];
  }

  return items
    .map((item) => scoreSuggestion(item, normalizedQuery))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return left.score - right.score;
      }
      return String(left.title || "").localeCompare(String(right.title || ""), "ko");
    })
    .slice(0, SEARCH_RESULT_LIMIT)
    .map(({ score, ...item }) => item);
}

function mergeSuggestionsBySymbol(...groups) {
  const merged = new Map();

  groups.flat().filter(Boolean).forEach((item) => {
    const key = String(item.symbol || item.title || item.value || "").trim().toUpperCase();
    if (!key) {
      return;
    }

    if (!merged.has(key)) {
      merged.set(key, {
        ...item,
        aliases: [...new Set([...(item.aliases || [])].filter(Boolean))],
      });
      return;
    }

    const existing = merged.get(key);
    merged.set(key, {
      ...existing,
      ...item,
      aliases: [...new Set([...(existing.aliases || []), ...(item.aliases || [])].filter(Boolean))],
    });
  });

  return [...merged.values()];
}

async function fetchJson(url, fetchImpl = fetch, options = {}) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    throw new Error(`시세 검색 요청이 실패했습니다. (${response.status})`);
  }

  return response.json();
}

async function fetchText(url, fetchImpl = fetch, options = {}) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    throw new Error(`종목 목록 요청이 실패했습니다. (${response.status})`);
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const buffer = await response.arrayBuffer();
  const charsetMatch = contentType.match(/charset=([^;]+)/i);
  const preferredEncoding = String(options.encoding || charsetMatch?.[1] || "utf-8").trim().toLowerCase();

  try {
    return new TextDecoder(preferredEncoding).decode(buffer);
  } catch (error) {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function getUpbitCryptoCatalog(fetchImpl = fetch) {
  if (cacheStore.cryptoCatalog.expiresAt > Date.now() && cacheStore.cryptoCatalog.items.length) {
    return cacheStore.cryptoCatalog.items;
  }

  const payload = await fetchJson(UPBIT_MARKET_ALL_URL, fetchImpl, {
    headers: {
      Accept: "application/json",
    },
  });

  const items = (Array.isArray(payload) ? payload : [])
    .filter((item) => String(item.market || "").startsWith("KRW-"))
    .map((item) => {
      const ticker = String(item.market || "").replace(/^KRW-/, "").trim().toUpperCase();
      const koreanName = String(item.korean_name || ticker).trim();
      const englishName = String(item.english_name || "").trim();
      const value = `${koreanName}(${ticker})`;
      return {
        market: "암호화폐",
        value,
        title: value,
        meta: "업비트 KRW 마켓",
        symbol: String(item.market || "").trim(),
        aliases: [koreanName, englishName, ticker],
      };
    });

  cacheStore.cryptoCatalog = {
    expiresAt: Date.now() + UPBIT_CACHE_TTL,
    items,
  };

  return items;
}

async function getKrxStockCatalog(fetchImpl = fetch) {
  if (cacheStore.krStockCatalog.expiresAt > Date.now() && cacheStore.krStockCatalog.items.length) {
    return cacheStore.krStockCatalog.items;
  }

  const html = await fetchText(KRX_CORP_LIST_URL, fetchImpl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0",
      Referer: "https://kind.krx.co.kr/",
    },
    encoding: "euc-kr",
  });

  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) =>
      [...match[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => stripHtml(cellMatch[1]))
    )
    .filter((cells) => cells.length >= 2);

  if (!rows.length) {
    throw new Error("국내주식 목록을 파싱하지 못했습니다.");
  }

  const headerIndex = rows.findIndex((cells) => cells.includes("회사명") && cells.includes("종목코드"));
  const dataRows = headerIndex >= 0 ? rows.slice(headerIndex + 1) : rows;
  const headerRow = headerIndex >= 0 ? rows[headerIndex] : [];
  const nameColumn = Math.max(headerRow.indexOf("회사명"), 0);
  const codeColumn = Math.max(headerRow.indexOf("종목코드"), 1);

  const items = dataRows
    .map((cells) => {
      const name = String(cells[nameColumn] || "").trim();
      const code = String(cells[codeColumn] || "").trim().toUpperCase();
      if (!name || !/^[0-9A-Z]{6}$/.test(code)) {
        return null;
      }

      const value = `${name}(${code})`;
      return {
        market: "국내주식",
        value,
        title: value,
        meta: "KRX 종목코드",
        symbol: code,
        aliases: [name, code],
      };
    })
    .filter(Boolean);

  cacheStore.krStockCatalog = {
    expiresAt: Date.now() + KRX_CACHE_TTL,
    items,
  };

  return items;
}

function mapTwelveSymbolItem(item, marketLabel) {
  const symbol = String(item.symbol || "").trim().toUpperCase();
  const instrumentName = String(item.instrument_name || item.name || "").trim();
  if (!symbol || !instrumentName) {
    return null;
  }

  const exchange = String(item.exchange || item.mic_code || item.type || "").trim();
  const value = `${instrumentName} (${symbol})`;
  return {
    market: marketLabel,
    value,
    title: value,
    meta: exchange ? `${exchange} · ${marketLabel}` : `${marketLabel} 티커`,
    symbol,
    aliases: [instrumentName, symbol, item.exchange, item.country, item.currency].filter(Boolean),
  };
}

async function searchTwelveDataSymbols(rootDir, query, marketLabel, fetchImpl = fetch) {
  const apiKey = await resolveEnvValue(rootDir, TWELVE_DATA_API_KEY);
  if (!apiKey) {
    return [];
  }

  const url = new URL("https://api.twelvedata.com/symbol_search");
  url.searchParams.set("symbol", query);
  url.searchParams.set("outputsize", "24");
  url.searchParams.set("apikey", apiKey);

  const payload = await fetchJson(url, fetchImpl, {
    headers: {
      Accept: "application/json",
    },
  });

  const items = Array.isArray(payload?.data) ? payload.data : [];
  const filtered = items.filter((item) => {
    const country = String(item.country || "").toLowerCase();
    const exchange = String(item.exchange || item.mic_code || "").toLowerCase();

    if (marketLabel === "미국주식") {
      return (
        country.includes("united states") ||
        country === "us" ||
        exchange.includes("nasdaq") ||
        exchange.includes("nyse") ||
        exchange.includes("amex")
      );
    }

    return (
      country.includes("korea") ||
      exchange.includes("krx") ||
      exchange.includes("kosdaq") ||
      exchange.includes("kospi")
    );
  });

  return filtered.map((item) => mapTwelveSymbolItem(item, marketLabel)).filter(Boolean);
}

async function searchAssets({ rootDir, market, query, fetchImpl = fetch }) {
  const marketLabel = String(market || "").trim();
  const trimmedQuery = String(query || "").trim();

  if (!marketLabel || !trimmedQuery) {
    return [];
  }

  if (marketLabel === "암호화폐") {
    const items = await getUpbitCryptoCatalog(fetchImpl);
    return rankSuggestions(items, trimmedQuery);
  }

  if (marketLabel === "국내주식") {
    try {
      const items = await getKrxStockCatalog(fetchImpl);
      return rankSuggestions(items, trimmedQuery);
    } catch (error) {
      const fallback = await searchTwelveDataSymbols(rootDir, trimmedQuery, marketLabel, fetchImpl);
      return rankSuggestions(fallback, trimmedQuery);
    }
  }

  if (marketLabel === "미국주식") {
    const remoteItems = await searchTwelveDataSymbols(rootDir, trimmedQuery, marketLabel, fetchImpl);
    const items = mergeSuggestionsBySymbol(US_STOCK_SEED_CATALOG, remoteItems);
    return rankSuggestions(items, trimmedQuery);
  }

  return [];
}

module.exports = {
  searchAssets,
};
