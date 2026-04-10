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
    name: "XRP",
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
  팔란티어: {
    name: "팔란티어",
    symbol: "PLTR",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  PLTR: {
    name: "PLTR",
    symbol: "PLTR",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  써클: {
    name: "써클",
    symbol: "CRCL",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
  CRCL: {
    name: "CRCL",
    symbol: "CRCL",
    market: "us-stock",
    currency: "USD",
    priceSource: "twelve-data",
  },
});

function getDefaultAssetMetadata(name = "") {
  return DEFAULT_ASSET_METADATA[String(name || "").trim()] || {};
}

function mergeAssetMetadata(item = {}, fallbackName = "") {
  const resolvedName = String(item.name || item.asset || fallbackName || "").trim();
  const defaults = getDefaultAssetMetadata(resolvedName);

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
  const base = typeof item === "string" ? { name: item } : item;
  const merged = mergeAssetMetadata(base, base.name);
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
      items: (Array.isArray(group.items) ? group.items : []).map((item) => normalizeTargetItem(item)),
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
  getDefaultAssetMetadata,
  mergeAssetMetadata,
  normalizeHoldingMetadata,
  normalizeTargetGroups,
  normalizeTargetItem,
  resolveAssetCategory,
};
