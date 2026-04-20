const path = require("path");
const { readLocalEnvFilesSync } = require("./env-file");

const BOARD_VARIANT_KEYS = ["BOARD_VARIANT"];
const OWNER_STATE_KEY_KEYS = ["OWNER_STATE_KEY"];

const SECTION_VISIBILITY_OPTIONS = Object.freeze([
  { id: "guide-section", title: "안내 메뉴" },
  { id: "targets-section", title: "관심종목" },
  { id: "portfolio-overview-section", title: "자산 분포" },
  { id: "timeline-section", title: "거래 타임라인" },
  { id: "notes-section", title: "메모" },
  { id: "holdings-section", title: "보유 종목" },
  { id: "strategy-state-section", title: "전략 상태" },
  { id: "performance-section", title: "실현손익 추이" },
  { id: "insights-section", title: "암호화폐 방어지표" },
]);

const ALL_SECTION_IDS = Object.freeze(SECTION_VISIBILITY_OPTIONS.map((item) => item.id));
const DEFAULT_LIVE_PRICE_PREFERENCES = Object.freeze({
  showGlobalIndices: true,
});
const MAX_TRADE_QUICK_ASSETS = 24;

const BOARD_VARIANT_CONFIGS = Object.freeze({
  personal: Object.freeze({
    variant: "personal",
    heroEyebrow: "Personal Portfolio Board",
    heroTitle: "Sniper Capital Board",
    browserTitle: "Sniper Capital Board",
  }),
  "blank-family": Object.freeze({
    variant: "blank-family",
    heroEyebrow: "Portfolio Board",
    heroTitle: "투자 현황 보드",
    browserTitle: "Portfolio Board",
  }),
});

let localEnvCache = null;

function readLocalEnv() {
  if (localEnvCache) {
    return localEnvCache;
  }

  const rootDir = path.resolve(__dirname, "..");
  const merged = readLocalEnvFilesSync(rootDir);
  localEnvCache = merged;
  return merged;
}

function resolveEnvValue(keys = []) {
  for (const key of keys) {
    const processValue = String(process.env[key] || "").trim();
    if (processValue) {
      return processValue;
    }
  }

  const localEnv = readLocalEnv();
  for (const key of keys) {
    const localValue = String(localEnv[key] || "").trim();
    if (localValue) {
      return localValue;
    }
  }

  return "";
}

function normalizeBoardVariant(value = "") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "blank-family" ? "blank-family" : "personal";
}

function resolveBoardVariant() {
  return normalizeBoardVariant(resolveEnvValue(BOARD_VARIANT_KEYS));
}

function resolvePortfolioVariant(portfolio = null, fallbackVariant = resolveBoardVariant()) {
  return normalizeBoardVariant(portfolio?.metadata?.boardVariant || fallbackVariant);
}

function resolveOwnerStateKey() {
  const configured = String(resolveEnvValue(OWNER_STATE_KEY_KEYS) || "").trim();
  return configured || "owner";
}

function getBoardConfig(variant = resolveBoardVariant()) {
  return BOARD_VARIANT_CONFIGS[normalizeBoardVariant(variant)] || BOARD_VARIANT_CONFIGS.personal;
}

function getSectionVisibilityOptions(variant = resolveBoardVariant()) {
  if (normalizeBoardVariant(variant) === "blank-family") {
    return [...SECTION_VISIBILITY_OPTIONS];
  }

  return SECTION_VISIBILITY_OPTIONS.filter((item) => item.id !== "guide-section");
}

function getDefaultVisibleSections(variant = resolveBoardVariant()) {
  if (normalizeBoardVariant(variant) === "blank-family") {
    return [
      "guide-section",
      "targets-section",
      "portfolio-overview-section",
      "timeline-section",
      "holdings-section",
    ];
  }

  return getSectionVisibilityOptions(variant).map((item) => item.id);
}

function normalizeVisibleSections(visibleSections, variant = resolveBoardVariant()) {
  const validIds = new Set(getSectionVisibilityOptions(variant).map((item) => item.id));
  if (!Array.isArray(visibleSections)) {
    return getDefaultVisibleSections(variant);
  }

  const requested = visibleSections.map((item) => String(item || "").trim()).filter((item) => validIds.has(item));
  return [...new Set(requested)];
}

function normalizeTradeQuickAssetItem(item = {}) {
  const market = String(item?.market || "").trim();
  if (!["국내주식", "미국주식", "암호화폐"].includes(market)) {
    return null;
  }

  const asset = String(item?.asset || item?.name || "").trim();
  const rawSymbol = String(item?.symbol || "").trim();
  let symbol = rawSymbol;

  if (market === "미국주식") {
    const upper = rawSymbol.toUpperCase();
    symbol = /^[A-Z.\-]{1,15}$/.test(upper) ? upper : "";
  } else if (market === "국내주식") {
    symbol = /^[0-9]{6}$/.test(rawSymbol) ? rawSymbol : "";
  } else if (market === "암호화폐") {
    const ticker = rawSymbol.toUpperCase().replace(/^KRW-/, "");
    symbol = /^[A-Z0-9]{2,15}$/.test(ticker) ? `KRW-${ticker}` : "";
  }

  if (!asset && !symbol) {
    return null;
  }

  return {
    market,
    asset: asset || symbol.replace(/^KRW-/, ""),
    symbol,
    updatedAt: String(item?.updatedAt || item?.addedAt || "").trim(),
  };
}

function normalizeTradeQuickAssets(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  const registry = new Map();
  items.forEach((item) => {
    const normalized = normalizeTradeQuickAssetItem(item);
    if (!normalized) {
      return;
    }

    const key = `${normalized.market}:${normalized.symbol || String(normalized.asset).toLowerCase().replace(/\s+/g, "")}`;
    if (registry.has(key)) {
      registry.delete(key);
    }
    registry.set(key, normalized);
  });

  return Array.from(registry.values()).slice(-MAX_TRADE_QUICK_ASSETS);
}

function normalizeUiPreferences(uiPreferences = {}, variant = resolveBoardVariant()) {
  const updatedAt = String(uiPreferences?.updatedAt || "").trim();
  return {
    visibleSections: normalizeVisibleSections(uiPreferences?.visibleSections, variant),
    livePrice: {
      showGlobalIndices: uiPreferences?.livePrice?.showGlobalIndices !== false,
    },
    tradeQuickAssets: normalizeTradeQuickAssets(uiPreferences?.tradeQuickAssets),
    hiddenHoldings: normalizeTradeQuickAssets(uiPreferences?.hiddenHoldings),
    updatedAt,
  };
}

module.exports = {
  ALL_SECTION_IDS,
  DEFAULT_LIVE_PRICE_PREFERENCES,
  SECTION_VISIBILITY_OPTIONS,
  getSectionVisibilityOptions,
  getBoardConfig,
  getDefaultVisibleSections,
  normalizeBoardVariant,
  normalizeUiPreferences,
  normalizeVisibleSections,
  resolvePortfolioVariant,
  resolveBoardVariant,
  resolveOwnerStateKey,
};
