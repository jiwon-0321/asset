const DEFAULT_ASSET_METADATA = Object.freeze({
  비트코인: {
    name: "비트코인",
    symbol: "KRW-BTC",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  BTC: {
    name: "BTC",
    symbol: "KRW-BTC",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  XRP: {
    name: "엑스알피(리플)",
    symbol: "KRW-XRP",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  ETH: {
    name: "ETH",
    symbol: "KRW-ETH",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  솔라나: {
    name: "솔라나",
    symbol: "KRW-SOL",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  SOL: {
    name: "SOL",
    symbol: "KRW-SOL",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  도지코인: {
    name: "도지코인",
    symbol: "KRW-DOGE",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  DOGE: {
    name: "DOGE",
    symbol: "KRW-DOGE",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  에이다: {
    name: "에이다",
    symbol: "KRW-ADA",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  ADA: {
    name: "ADA",
    symbol: "KRW-ADA",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  수이: {
    name: "수이",
    symbol: "KRW-SUI",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  SUI: {
    name: "SUI",
    symbol: "KRW-SUI",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  아발란체: {
    name: "아발란체",
    symbol: "KRW-AVAX",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  AVAX: {
    name: "AVAX",
    symbol: "KRW-AVAX",
    market: "crypto",
    currency: "KRW",
    priceSource: "upbit",
  },
  팔란티어: {
    name: "Palantir Technologies",
    symbol: "PLTR",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  PLTR: {
    name: "Palantir Technologies",
    symbol: "PLTR",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  써클: {
    name: "Circle Internet Group",
    symbol: "CRCL",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  CRCL: {
    name: "Circle Internet Group",
    symbol: "CRCL",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  엔비디아: {
    name: "NVIDIA Corporation",
    symbol: "NVDA",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  NVDA: {
    name: "NVIDIA Corporation",
    symbol: "NVDA",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  애플: {
    name: "Apple Inc.",
    symbol: "AAPL",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  AAPL: {
    name: "Apple Inc.",
    symbol: "AAPL",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  테슬라: {
    name: "Tesla, Inc.",
    symbol: "TSLA",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  TSLA: {
    name: "Tesla, Inc.",
    symbol: "TSLA",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  마이크로소프트: {
    name: "Microsoft Corporation",
    symbol: "MSFT",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  MSFT: {
    name: "Microsoft Corporation",
    symbol: "MSFT",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  아마존: {
    name: "Amazon.com, Inc.",
    symbol: "AMZN",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  AMZN: {
    name: "Amazon.com, Inc.",
    symbol: "AMZN",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  메타: {
    name: "Meta Platforms, Inc.",
    symbol: "META",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  META: {
    name: "Meta Platforms, Inc.",
    symbol: "META",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  삼성전자: {
    name: "삼성전자",
    symbol: "005930",
    market: "kr-stock",
    currency: "KRW",
    priceSource: "kis",
  },
  SK하이닉스: {
    name: "SK하이닉스",
    symbol: "000660",
    market: "kr-stock",
    currency: "KRW",
    priceSource: "kis",
  },
  에스케이하이닉스: {
    name: "SK하이닉스",
    symbol: "000660",
    market: "kr-stock",
    currency: "KRW",
    priceSource: "kis",
  },
});

function getDefaultAssetMetadata(name = "") {
  return DEFAULT_ASSET_METADATA[String(name || "").trim()] || {};
}

function extractTickerCandidate(value = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const matched = raw.match(/\(([^()]+)\)\s*$/);
  const candidate = (matched ? matched[1] : raw).trim().toUpperCase();
  return /^[A-Z0-9.\-]{2,15}$/.test(candidate) ? candidate : "";
}

function inferDynamicAssetMetadata(item = {}, resolvedName = "") {
  const rawSymbol = String(item.symbol || "").trim();
  const market = String(item.market || "").trim();
  const priceSource = String(item.priceSource || "").trim();

  if (market === "crypto" || priceSource === "upbit" || rawSymbol.startsWith("KRW-")) {
    const ticker = rawSymbol.startsWith("KRW-")
      ? rawSymbol.replace(/^KRW-/, "").trim().toUpperCase()
      : extractTickerCandidate(rawSymbol || resolvedName);

    if (ticker) {
      return {
        name: resolvedName || ticker,
        symbol: `KRW-${ticker}`,
        market: "crypto",
        currency: "KRW",
        priceSource: "upbit",
      };
    }
  }

  if (market === "us-stock" || priceSource === "twelve-data") {
    const ticker = extractTickerCandidate(rawSymbol || resolvedName);
    if (ticker) {
      return {
        name: resolvedName || ticker,
        symbol: ticker,
        market: "us-stock",
        currency: "USD",
        priceSource: "twelve-data",
      };
    }
  }

  if (market === "kr-stock") {
    const code = /^[0-9]{6}$/.test(rawSymbol) ? rawSymbol : "";
    if (code) {
      return {
        name: resolvedName || code,
        symbol: code,
        market: "kr-stock",
        currency: "KRW",
        priceSource: "kis",
      };
    }
  }

  return {};
}

function mergeAssetMetadata(item = {}, fallbackName = "") {
  const resolvedName = String(item.name || item.asset || fallbackName || "").trim();
  const defaults = {
    ...inferDynamicAssetMetadata(item, resolvedName),
    ...getDefaultAssetMetadata(resolvedName),
  };

  return {
    ...defaults,
    ...item,
    name: resolvedName || defaults.name || "",
    symbol: String(item.symbol || defaults.symbol || "").trim(),
    market: String(item.market || defaults.market || "").trim(),
    currency: String(item.currency || defaults.currency || "").trim(),
    priceSource: String(item.priceSource || defaults.priceSource || "").trim(),
  };
}

function normalizeHoldingMetadata(holding = {}) {
  const merged = mergeAssetMetadata(holding, holding.asset);
  return {
    ...holding,
    asset: String(holding.asset || merged.name || "").trim(),
    name: merged.name,
    symbol: merged.symbol,
    market: merged.market,
    currency: merged.currency,
    priceSource: merged.priceSource,
  };
}

function normalizeTargetItem(item = {}) {
  const base =
    typeof item === "string"
      ? { name: item }
      : item && typeof item === "object"
        ? item
        : {};
  const merged = mergeAssetMetadata(base, base.name || base.asset || base.symbol || "");
  return {
    ...base,
    name: merged.name,
    symbol: merged.symbol,
    market: merged.market,
    currency: merged.currency,
    priceSource: merged.priceSource,
  };
}

function normalizeTargetGroups(targets = {}) {
  const groups = Array.isArray(targets.groups) ? targets.groups : [];
  return {
    ...targets,
    groups: groups.map((group) => ({
      ...group,
      items: (Array.isArray(group.items) ? group.items : [])
        .map((item) => normalizeTargetItem(item))
        .filter((item) => item.name || item.symbol),
    })),
  };
}

function resolveAssetCategory(item = {}) {
  const market = String(item.market || "").trim();
  if (market === "crypto") {
    return "암호화폐";
  }
  if (market === "us-stock") {
    return "해외주식";
  }
  if (market === "kr-stock") {
    return "국내주식";
  }
  return item.platform === "업비트" ? "암호화폐" : "국내주식";
}

module.exports = {
  DEFAULT_ASSET_METADATA,
  extractTickerCandidate,
  getDefaultAssetMetadata,
  inferDynamicAssetMetadata,
  mergeAssetMetadata,
  normalizeHoldingMetadata,
  normalizeTargetGroups,
  normalizeTargetItem,
  resolveAssetCategory,
};
