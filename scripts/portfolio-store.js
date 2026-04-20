const fs = require("fs/promises");
const path = require("path");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");
const { buildLocalPortfolioPath } = require("../lib/storage-manifest");
const { normalizeHoldingMetadata, normalizeTargetItem, resolveAssetCategory } = require("../lib/asset-metadata");
const { normalizeBrokerName, estimateTradeFee } = require("../lib/trade-fee-policy");
const BACKUP_LIMIT = 10;

const quantityFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 8,
});

const CASH_PLATFORM_BY_BROKER = {
  카카오증권: "카카오증권 예수금",
  미래에셋: "미래에셋 예수금",
  업비트: "업비트 KRW잔액",
};

const CASH_PLATFORM_ORDER = [
  "카카오증권 예수금",
  "카카오페이머니",
  "업비트 KRW잔액",
  "미래에셋 예수금",
  "수동 현금 조정",
];

const MANUAL_CASH_ADJUSTMENT_PLATFORM = "수동 현금 조정";
const DEFAULT_MANUAL_CASH_ADJUSTMENT_NOTE = "현금 보유 카드에서 직접 수정";

const PRICE_KEY_BY_ASSET = {
  삼성전자: "samsungElectronics",
  SK하이닉스: "skHynix",
  비트코인: "btc",
  BTC: "btc",
  XRP: "xrp",
  ETH: "eth",
};

function parseTradeAssetDescriptor(assetInput, market) {
  const raw = String(assetInput || "").trim();
  if (!raw) {
    return {
      asset: "",
      symbol: "",
    };
  }

  const matched = raw.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  const namePart = matched ? matched[1].trim() : raw;
  const codePart = matched ? matched[2].trim().toUpperCase() : "";
  const upperRaw = raw.toUpperCase();

  if (market === "암호화폐") {
    let ticker = codePart;
    if (!ticker && /^[A-Z0-9]{2,15}$/.test(upperRaw)) {
      ticker = upperRaw;
    }
    if (!ticker) {
      if (namePart === "비트코인" || upperRaw === "BTC") {
        ticker = "BTC";
      } else if (namePart === "ETH" || namePart === "이더리움" || upperRaw === "ETH") {
        ticker = "ETH";
      } else if (namePart === "XRP" || namePart === "엑스알피" || upperRaw === "XRP") {
        ticker = "XRP";
      }
    }

    return {
      asset: matched ? namePart : ticker || namePart,
      symbol: ticker ? `KRW-${ticker}` : "",
    };
  }

  if (market === "미국주식") {
    let ticker = codePart;
    if (!ticker && /^[A-Z.\-]{1,15}$/.test(upperRaw)) {
      ticker = upperRaw;
    }

    return {
      asset: matched ? namePart : raw,
      symbol: ticker,
    };
  }

  if (market === "국내주식") {
    return {
      asset: matched ? namePart : raw,
      symbol: codePart && /^[0-9]{6}$/.test(codePart) ? codePart : "",
    };
  }

  return {
    asset: raw,
    symbol: "",
  };
}

function normalizeMatchingText(value = "") {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function normalizeAssetNameForMatching(assetInput, market) {
  const descriptor = parseTradeAssetDescriptor(assetInput, market);
  return normalizeMatchingText(descriptor.asset || assetInput);
}

function normalizeNumber(value, decimals = 8) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const rounded = Number(value.toFixed(decimals));
  return Math.abs(rounded) < 1e-10 ? 0 : rounded;
}

function normalizeMoney(value) {
  return normalizeNumber(value, 8);
}

function normalizeQuantity(value) {
  return normalizeNumber(value, 8);
}

function normalizeRate(value) {
  return normalizeNumber(value, 12);
}

function normalizeOptionalMoney(value, fieldLabel) {
  if (value === "" || value == null) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldLabel} 값을 확인하세요.`);
  }

  return normalizeMoney(numeric);
}

function normalizeOptionalRate(value, fieldLabel) {
  if (value === "" || value == null) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`${fieldLabel} 값을 확인하세요.`);
  }

  return normalizeRate(numeric);
}

function parseBasisYear(label) {
  const match = String(label || "").match(/(\d{4})/);
  return match ? Number(match[1]) : new Date().getFullYear();
}

function parseBasisDateLabel(label) {
  const match = String(label || "").match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function parsePerformanceStartDate(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);

  if (!match) {
    return null;
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function parseMonthDay(value) {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})$/);

  if (!match) {
    throw new Error("날짜는 M/D 형식으로 입력하세요.");
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error("유효한 날짜를 입력하세요.");
  }

  return { month, day };
}

function toTradeDate(value, year) {
  const { month, day } = parseMonthDay(value);
  return new Date(year, month - 1, day);
}

function formatBasisDateLabel(year, month, day) {
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")} 기준`;
}

function getTodayBasisDateLabel() {
  const now = new Date();
  return formatBasisDateLabel(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function compareDateOnly(left, right) {
  return left.getTime() - right.getTime();
}

function filterRealizedForPerformance(realized = [], basisDateLabel, performanceStartDate) {
  const startDate = parsePerformanceStartDate(performanceStartDate);
  if (!startDate) {
    return Array.isArray(realized) ? [...realized] : [];
  }

  const year = parseBasisYear(basisDateLabel);
  return (Array.isArray(realized) ? realized : []).filter((item) => {
    try {
      return compareDateOnly(toTradeDate(item.date, year), startDate) >= 0;
    } catch (error) {
      return true;
    }
  });
}

function calculateTradeFee({ broker, side, amount, market, quantity }) {
  const estimate = estimateTradeFee({ broker, side, amount, market, quantity });
  return normalizeMoney(Number(estimate?.totalFee || 0));
}

function parseProfitNote(note) {
  if (typeof note !== "string") {
    return null;
  }

  const match = note
    .replace(/\s+/g, " ")
    .match(/([+-])\s*([\d,]+(?:\.\d+)?)원(?:\s*\(([+-]?\d+(?:\.\d+)?)%\))?/);

  if (!match) {
    return null;
  }

  const pnl = (match[1] === "-" ? -1 : 1) * Number(match[2].replace(/,/g, ""));
  const percentValue = match[3] == null ? null : Number(match[3]) / 100;
  const returnRate =
    percentValue == null ? null : match[3].startsWith("-") ? percentValue : pnl < 0 ? -Math.abs(percentValue) : percentValue;

  return {
    pnl: normalizeMoney(pnl),
    returnRate: returnRate == null ? null : normalizeRate(returnRate),
  };
}

function formatQuantityForLabel(value) {
  return quantityFormatter.format(value);
}

function getPriceKey(asset) {
  return PRICE_KEY_BY_ASSET[asset] || null;
}

function ensureAnalyticsPriceMap(analytics) {
  if (!analytics.prices || typeof analytics.prices !== "object") {
    analytics.prices = {};
  }
  if (!analytics.assetPrices || typeof analytics.assetPrices !== "object") {
    analytics.assetPrices = {};
  }
}

function getAssetPrice(analytics, asset, fallback = 0) {
  ensureAnalyticsPriceMap(analytics);

  const priceKey = getPriceKey(asset);
  if (priceKey && Number.isFinite(analytics.prices[priceKey])) {
    return analytics.prices[priceKey];
  }

  if (Number.isFinite(analytics.assetPrices[asset])) {
    return analytics.assetPrices[asset];
  }

  return fallback;
}

function updateAssetPrice(analytics, asset, price) {
  ensureAnalyticsPriceMap(analytics);

  const priceKey = getPriceKey(asset);
  if (priceKey) {
    analytics.prices[priceKey] = normalizeMoney(price);
    return;
  }

  analytics.assetPrices[asset] = normalizeMoney(price);
}

function normalizeTradeStage(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, 40) : null;
}

const STRATEGY_SELL_STAGE_VALUES = new Set([
  "1단계 익절",
  "2단계 익절",
  "3단계 추적",
  "가격 손절",
  "시간 손절",
]);

function isSellStrategyStageValue(stage = "") {
  const normalized = normalizeTradeStage(stage);
  return Boolean(normalized) && STRATEGY_SELL_STAGE_VALUES.has(normalized);
}

function normalizeStrategyBaselineQuantity(value) {
  const quantity = normalizeQuantity(Number(value || 0));
  return quantity > 0 ? quantity : null;
}

function normalizeStoredTimestamp(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

function normalizeTradeInput(input, basisLabel, options = {}) {
  const allowPastDate = options.allowPastDate === true;
  const autoTimestamp = options.autoTimestamp !== false;
  const touchUpdatedAt = options.touchUpdatedAt === true;
  const market = String(input.market || "").trim();
  if (!["국내주식", "미국주식", "암호화폐"].includes(market)) {
    throw new Error("시장 값을 확인하세요.");
  }

  const broker = normalizeBrokerName(input.broker || (market === "암호화폐" ? "업비트" : ""));
  if (!broker) {
    throw new Error("플랫폼을 선택하세요.");
  }

  if ((market === "국내주식" || market === "미국주식") && broker === "업비트") {
    throw new Error(`${market} 거래는 증권사를 선택하세요.`);
  }

  if (market === "암호화폐" && broker !== "업비트") {
    throw new Error("암호화폐 거래는 업비트만 지원합니다.");
  }

  const parsedDate = parseMonthDay(input.date);
  const date = `${parsedDate.month}/${String(parsedDate.day).padStart(2, "0")}`;
  const basisYear = parseBasisYear(basisLabel);
  const basis = parseBasisDateLabel(basisLabel);
  const tradeDate = toTradeDate(date, basisYear);
  const basisDate = basis ? new Date(basis.year, basis.month - 1, basis.day) : tradeDate;

  if (!allowPastDate && compareDateOnly(tradeDate, basisDate) < 0) {
    throw new Error("기준일 이전의 과거 거래는 추가할 수 없습니다.");
  }

  const parsedAsset = parseTradeAssetDescriptor(input.asset, market);
  const asset = parsedAsset.asset;
  if (!asset) {
    throw new Error("자산명을 입력하세요.");
  }

  const explicitSymbol = String(input.symbol || "").trim();
  let symbol = parsedAsset.symbol;
  if (!symbol && explicitSymbol) {
    if (market === "미국주식") {
      symbol = explicitSymbol.toUpperCase();
    } else if (market === "국내주식" && /^[0-9]{6}$/.test(explicitSymbol)) {
      symbol = explicitSymbol;
    } else if (market === "암호화폐") {
      const upperSymbol = explicitSymbol.toUpperCase();
      symbol = upperSymbol.startsWith("KRW-") ? upperSymbol : `KRW-${upperSymbol}`;
    }
  }

  const side = String(input.side || "").trim();
  if (!["매수", "매도"].includes(side)) {
    throw new Error("매수/매도 값을 확인하세요.");
  }

  const quantity = Number(input.quantity);
  const price = Number(input.price);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("수량은 0보다 커야 합니다.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("단가는 0보다 커야 합니다.");
  }

  const computedAmount = normalizeMoney(quantity * price);
  const amount = input.amount === "" || input.amount == null ? computedAmount : normalizeMoney(Number(input.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("거래금액을 확인하세요.");
  }

  const fee =
    input.fee === "" || input.fee == null
      ? calculateTradeFee({ broker, side, amount, market, quantity })
      : normalizeMoney(Number(input.fee));
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("수수료를 확인하세요.");
  }

  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : null;
  const stage = normalizeTradeStage(input.stage);
  const strategyBaselineQuantity = isSellStrategyStageValue(stage) ? normalizeStrategyBaselineQuantity(input.strategyBaselineQuantity) : null;
  const realizedPnlOverride = normalizeOptionalMoney(input.realizedPnlOverride, "실현손익 보정");
  const realizedReturnRateOverride = normalizeOptionalRate(input.realizedReturnRateOverride, "실현수익률 보정");
  const realizedReferencePrice = normalizeOptionalMoney(input.realizedReferencePrice, "실현 기준단가");
  const now = new Date().toISOString();
  const createdAt = normalizeStoredTimestamp(input.createdAt || input.addedAt) || (autoTimestamp ? now : "");
  const updatedAt = touchUpdatedAt
    ? now
    : normalizeStoredTimestamp(input.updatedAt) || createdAt || (autoTimestamp ? now : "");

  return {
    date,
    market,
    broker,
    asset,
    symbol,
    side,
    quantity: normalizeQuantity(quantity),
    price: normalizeMoney(price),
    amount,
    fee,
    stage,
    ...(strategyBaselineQuantity != null ? { strategyBaselineQuantity } : {}),
    ...(realizedPnlOverride != null ? { realizedPnlOverride } : {}),
    ...(realizedReturnRateOverride != null ? { realizedReturnRateOverride } : {}),
    ...(realizedReferencePrice != null ? { realizedReferencePrice } : {}),
    note,
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function getTradeCollectionKey(trade) {
  return trade.market === "암호화폐" ? "crypto" : "stocks";
}

function getTargetGroupMetaByMarket(market) {
  if (market === "암호화폐") {
    return {
      title: "암호화폐",
      label: "Crypto",
      tone: "crypto",
      summary: "가격이 열리면 가장 먼저 체크할 메인 코인",
    };
  }

  if (market === "미국주식") {
    return {
      title: "해외주식",
      label: "Global Equity",
      tone: "global",
      summary: "중장기 관점에서 우선순위가 높은 미국 주식",
    };
  }

  return {
    title: "국내주식",
    label: "Korea Equity",
    tone: "domestic",
    summary: "국내주식은 아직 후보를 비워두고 시장 강도부터 확인",
    emptyTitle: "아직 없음",
    emptyDescription: "국내주식은 다시 보고 싶은 섹터가 잡히는 순간 바로 추가합니다.",
  };
}

function getTargetItemMetadataFromInput(input) {
  const parsedAsset = parseTradeAssetDescriptor(input.asset, input.market);

  if (input.market === "암호화폐") {
    return normalizeTargetItem({
      name: parsedAsset.asset || String(input.asset || "").trim(),
      symbol: parsedAsset.symbol,
      market: "crypto",
      currency: "KRW",
      priceSource: "upbit",
    });
  }

  if (input.market === "미국주식") {
    return normalizeTargetItem({
      name: parsedAsset.asset || String(input.asset || "").trim(),
      symbol: parsedAsset.symbol,
      market: "us-stock",
      currency: "USD",
      priceSource: "twelve-data",
    });
  }

  return normalizeTargetItem({
    name: parsedAsset.asset || String(input.asset || "").trim(),
    symbol: parsedAsset.symbol,
    market: "kr-stock",
    currency: "KRW",
    priceSource: "kis",
  });
}

function normalizeTargetInput(input = {}) {
  const market = String(input.market || "").trim();
  if (!["국내주식", "미국주식", "암호화폐"].includes(market)) {
    throw new Error("관심종목 시장 값을 확인하세요.");
  }

  const asset = String(input.asset || "").trim();
  if (!asset) {
    throw new Error("관심종목 자산명을 입력하세요.");
  }

  const item = getTargetItemMetadataFromInput({ market, asset });
  if (!item.name) {
    throw new Error("관심종목 이름을 확인하세요.");
  }

  return {
    market,
    item,
  };
}

function appendTarget(portfolio, input) {
  const next = structuredClone(portfolio);
  const normalized = normalizeTargetInput(input);
  const groupMeta = getTargetGroupMetaByMarket(normalized.market);
  const groups = Array.isArray(next.targets?.groups) ? [...next.targets.groups] : [];
  const targetMarket =
    normalized.market === "암호화폐" ? "crypto" : normalized.market === "미국주식" ? "us-stock" : "kr-stock";
  const groupIndex = groups.findIndex((group) => {
    const firstItem = Array.isArray(group.items) ? group.items[0] : [];
    return group.title === groupMeta.title || group.tone === groupMeta.tone || firstItem?.market === targetMarket;
  });

  const targetGroup =
    groupIndex === -1
      ? {
          ...groupMeta,
          items: [],
        }
      : {
          ...groups[groupIndex],
          items: Array.isArray(groups[groupIndex].items) ? [...groups[groupIndex].items] : [],
        };

  const duplicateExists = targetGroup.items.some((item) => {
    const normalizedItem = normalizeTargetItem(item);
    if (normalized.item.symbol && normalizedItem.symbol) {
      return normalized.item.symbol === normalizedItem.symbol;
    }
    return normalized.item.name === normalizedItem.name;
  });

  if (duplicateExists) {
    throw new Error("이미 관심종목에 있는 자산입니다.");
  }

  targetGroup.items.push(normalized.item);

  if (groupIndex === -1) {
    groups.push(targetGroup);
  } else {
    groups[groupIndex] = targetGroup;
  }

  next.targets = {
    ...(next.targets || {}),
    groups,
  };

  return next;
}

function normalizeTargetDeletionInput(input = {}) {
  const market = String(input.market || "").trim();
  if (!["국내주식", "미국주식", "암호화폐"].includes(market)) {
    throw new Error("관심종목 시장 값을 확인하세요.");
  }

  const symbol = String(input.symbol || "").trim().toUpperCase();
  const name = String(input.name || input.asset || "").trim();
  const parsedAsset = parseTradeAssetDescriptor(symbol || name, market);

  if (!symbol && !name && !parsedAsset.symbol && !parsedAsset.asset) {
    throw new Error("삭제할 관심종목 정보를 확인하세요.");
  }

  return {
    market,
    symbol: symbol || parsedAsset.symbol,
    name: name || parsedAsset.asset,
  };
}

function normalizeStrategyBudgetMarket(value = "") {
  const market = String(value || "").trim();
  if (market === "암호화폐" || market === "crypto") {
    return "crypto";
  }
  if (market === "미국주식" || market === "us-stock") {
    return "us-stock";
  }
  if (market === "국내주식" || market === "kr-stock") {
    return "kr-stock";
  }
  throw new Error("전략 자금 시장 값을 확인하세요.");
}

function normalizeStrategyBudgetSymbol(symbol = "", market = "") {
  const raw = String(symbol || "").trim();
  if (!raw) {
    return "";
  }

  if (market === "crypto") {
    const upper = raw.toUpperCase();
    return upper.startsWith("KRW-") ? upper : `KRW-${upper}`;
  }

  if (market === "us-stock") {
    return raw.toUpperCase();
  }

  return raw;
}

function normalizeStrategyBudgetItems(strategyBudgets = {}) {
  const items = Array.isArray(strategyBudgets?.items) ? strategyBudgets.items : [];
  return items.reduce((accumulator, item) => {
    try {
      const market = normalizeStrategyBudgetMarket(item.market);
      const symbol = normalizeStrategyBudgetSymbol(item.symbol, market);
      const asset = String(item.asset || "").trim();
      const budget = normalizeMoney(Number(item.budget || 0));
      if (!(budget > 0) || (!symbol && !asset)) {
        return accumulator;
      }

      accumulator.push({
        market,
        symbol,
        asset,
        budget,
        updatedAt: String(item.updatedAt || "").trim(),
      });
    } catch (error) {
      return accumulator;
    }

    return accumulator;
  }, []);
}

function buildStrategyBudgetMatcher(input = {}) {
  const market = normalizeStrategyBudgetMarket(input.market);
  const symbol = normalizeStrategyBudgetSymbol(input.symbol, market);
  const asset = String(input.asset || input.name || "").trim();

  if (!symbol && !asset) {
    throw new Error("전략 자금을 연결할 종목 정보를 확인하세요.");
  }

  return {
    market,
    symbol,
    asset,
  };
}

function normalizeStrategyBudgetInput(input = {}) {
  const matcher = buildStrategyBudgetMatcher(input);
  const budget = normalizeMoney(Number(input.budget || 0));

  if (!(budget > 0)) {
    throw new Error("전략 자금을 확인하세요.");
  }

  return {
    ...matcher,
    budget,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeStrategyBudgetDeletionInput(input = {}) {
  return buildStrategyBudgetMatcher(input);
}

function matchesStrategyBudget(item = {}, matcher = {}) {
  if (!item || item.market !== matcher.market) {
    return false;
  }

  if (matcher.symbol && item.symbol) {
    return matcher.symbol === item.symbol;
  }

  return Boolean(matcher.asset) && matcher.asset === item.asset;
}

function upsertStrategyBudget(portfolio, input = {}) {
  const next = structuredClone(portfolio);
  const entry = normalizeStrategyBudgetInput(input);
  const items = normalizeStrategyBudgetItems(next.strategyBudgets);
  const index = items.findIndex((item) => matchesStrategyBudget(item, entry));

  if (index === -1) {
    items.push(entry);
  } else {
    items[index] = {
      ...items[index],
      ...entry,
    };
  }

  next.strategyBudgets = {
    items,
  };

  return next;
}

function deleteStrategyBudget(portfolio, input = {}) {
  const next = structuredClone(portfolio);
  const matcher = normalizeStrategyBudgetDeletionInput(input);
  const items = normalizeStrategyBudgetItems(next.strategyBudgets);
  const filtered = items.filter((item) => !matchesStrategyBudget(item, matcher));

  if (filtered.length === items.length) {
    throw new Error("삭제할 전략 자금을 찾지 못했습니다.");
  }

  next.strategyBudgets = {
    items: filtered,
  };

  return next;
}

function deleteTarget(portfolio, input) {
  const next = structuredClone(portfolio);
  const normalized = normalizeTargetDeletionInput(input);
  let removed = false;

  const groups = Array.isArray(next.targets?.groups) ? next.targets.groups : [];
  next.targets = {
    ...(next.targets || {}),
    groups: groups.map((group) => {
      const items = Array.isArray(group.items) ? group.items : [];
      const filteredItems = items.reduce((accumulator, item) => {
        const normalizedItem = normalizeTargetItem(item);
        if (!normalizedItem.name && !normalizedItem.symbol) {
          return accumulator;
        }
        const matchesSymbol = normalized.symbol && normalizedItem.symbol && normalized.symbol === normalizedItem.symbol;
        const matchesName = normalized.name && normalized.name === normalizedItem.name;
        if (matchesSymbol || matchesName) {
          removed = true;
          return accumulator;
        }
        accumulator.push(item);
        return accumulator;
      }, []);

      return {
        ...group,
        items: filteredItems,
      };
    }),
  };

  if (!removed) {
    throw new Error("삭제할 관심종목을 찾지 못했습니다.");
  }

  return next;
}

function getCashPlatformName(broker) {
  return CASH_PLATFORM_BY_BROKER[broker] || `${broker} 예수금`;
}

function normalizeInitialSetupMarket(value = "") {
  const normalized = String(value || "").trim();
  if (normalized === "암호화폐" || normalized === "crypto") {
    return "암호화폐";
  }
  if (normalized === "미국주식" || normalized === "us-stock") {
    return "미국주식";
  }
  return "국내주식";
}

function normalizeInitialSetupHoldingInput(input = {}) {
  const market = normalizeInitialSetupMarket(input.market);
  const rawAsset = String(input.asset || "").trim();
  if (!rawAsset) {
    throw new Error("보유 종목 이름을 입력하세요.");
  }

  const quantity = Number(input.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("보유 수량은 0보다 크게 입력하세요.");
  }

  const averagePrice = Number(input.averagePrice || 0);
  if (!Number.isFinite(averagePrice) || averagePrice <= 0) {
    throw new Error("평균 단가는 0보다 크게 입력하세요.");
  }

  let broker = normalizeBrokerName(input.broker || "");
  if (market === "암호화폐") {
    broker = "업비트";
  } else if (!broker) {
    broker = "카카오증권";
  }

  const parsedAsset = parseTradeAssetDescriptor(rawAsset, market);
  const metadata = getHoldingMetadataFromTrade({
    market,
    broker,
    asset: parsedAsset.asset || rawAsset,
    symbol: parsedAsset.symbol,
  });
  const platform = market === "암호화폐" ? "업비트" : broker;

  return normalizeHoldingMetadata({
    platform,
    asset: parsedAsset.asset || rawAsset,
    ...metadata,
    quantity: normalizeQuantity(quantity),
    averagePrice: normalizeMoney(averagePrice),
    valuation: normalizeMoney(quantity * averagePrice),
    returnRate: 0,
  });
}

function normalizeInitialSetupInput(input = {}) {
  const cashAmount = normalizeMoney(Number(input.cashAmount || 0));
  if (!Number.isFinite(cashAmount) || cashAmount < 0) {
    throw new Error("시작 현금은 0원 이상으로 입력하세요.");
  }

  const holdings = (Array.isArray(input.holdings) ? input.holdings : [])
    .map((item) => (item && typeof item === "object" ? normalizeInitialSetupHoldingInput(item) : null))
    .filter(Boolean);

  if (cashAmount <= 0 && holdings.length === 0) {
    throw new Error("시작 현금이나 보유 종목 중 하나는 입력하세요.");
  }

  return {
    cashAmount,
    holdings,
  };
}

function normalizeManualCashAdjustmentInput(input = {}) {
  const rawValue =
    typeof input?.cashTotal === "string"
      ? String(input.cashTotal).replace(/[,\s원₩]/g, "")
      : input?.cashTotal;

  if (rawValue === "" || rawValue === null || rawValue === undefined) {
    throw new Error("현재 현금 총액을 입력하세요.");
  }

  const numericValue = Number(rawValue);
  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw new Error("현재 현금 총액은 0원 이상 숫자로 입력하세요.");
  }

  const note = String(input?.note || "").trim();

  return {
    cashTotal: normalizeMoney(numericValue),
    note: note || DEFAULT_MANUAL_CASH_ADJUSTMENT_NOTE,
  };
}

function hasPortfolioContent(portfolio = {}) {
  const stockTrades = Array.isArray(portfolio?.trades?.stocks) ? portfolio.trades.stocks.length : 0;
  const cryptoTrades = Array.isArray(portfolio?.trades?.crypto) ? portfolio.trades.crypto.length : 0;
  const holdingsCount = Array.isArray(portfolio?.holdings) ? portfolio.holdings.length : 0;
  const targetCount = Array.isArray(portfolio?.targets?.groups)
    ? portfolio.targets.groups.reduce((total, group) => {
        const items = Array.isArray(group?.items) ? group.items.length : 0;
        return total + items;
      }, 0)
    : 0;
  const totalAssets = Number(portfolio?.summary?.totalAssets || 0);
  const initialInvestment = Number(portfolio?.summary?.initialInvestment || 0);

  return stockTrades + cryptoTrades + holdingsCount + targetCount > 0 || totalAssets > 0 || initialInvestment > 0;
}

function applyInitialPortfolioSetup(portfolio = {}, input = {}) {
  const normalized = normalizeInitialSetupInput(input);
  const next = structuredClone(portfolio || {});
  const analytics = structuredClone(next.analytics || {});

  if (!analytics.prices || typeof analytics.prices !== "object") {
    analytics.prices = {};
  }
  if (!analytics.assetPrices || typeof analytics.assetPrices !== "object") {
    analytics.assetPrices = {};
  }

  normalized.holdings.forEach((holding) => {
    updateAssetPrice(analytics, holding.asset, holding.averagePrice);
  });

  const holdings = revalueHoldings(normalized.holdings, analytics);
  const cashPositions = normalized.cashAmount > 0 ? sortCashPositions([{ platform: "시작 현금", amount: normalized.cashAmount }]) : [];
  const assetStatus = rebuildAssetStatus(holdings);
  const initialInvestment = normalizeMoney(
    holdings.reduce((total, item) => total + normalizeMoney(item.quantity * item.averagePrice), 0) + normalized.cashAmount
  );
  const metadata = {
    ...(next.metadata || {}),
    basisDateLabel: getTodayBasisDateLabel(),
  };
  const summary = rebuildSummary(
    {
      ...(next.summary || {}),
      initialInvestment,
    },
    assetStatus,
    cashPositions,
    [],
    metadata
  );

  return {
    ...next,
    metadata,
    summary,
    holdings,
    cashPositions,
    assetStatus,
    trades: {
      stocks: [],
      crypto: [],
    },
    realized: [],
    charts: buildChartData({
      basisDateLabel: metadata.basisDateLabel,
      performanceStartDate: metadata.realizedPerformanceStartDate,
      holdings,
      realized: [],
    }),
    analytics: {
      ...analytics,
      xrpDefense: {
        ...(analytics.xrpDefense || {}),
        initialQuantity: 0,
        initialAveragePrice: 0,
        soldQuantity: 0,
        averageSellNet: 0,
        rebuyQuantity: 0,
        averageRebuyGross: 0,
        defenseGain: 0,
        finalAveragePrice: 0,
        averageCutAmount: 0,
        averageCutRate: 0,
        realizedPnl: 0,
        remainingQuantity: 0,
        breakevenTargetBuyPrice: 0,
      },
    },
  };
}

function sortCashPositions(cashPositions) {
  return [...cashPositions].sort((left, right) => {
    const leftIndex = CASH_PLATFORM_ORDER.indexOf(left.platform);
    const rightIndex = CASH_PLATFORM_ORDER.indexOf(right.platform);

    if (leftIndex !== -1 || rightIndex !== -1) {
      if (leftIndex === -1) {
        return 1;
      }
      if (rightIndex === -1) {
        return -1;
      }
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }
    }

    return left.platform.localeCompare(right.platform, "ko");
  });
}

function applyTradeToCashPositions(cashPositions, trade) {
  const next = cashPositions.map((item) => ({ ...item }));
  const platform = getCashPlatformName(trade.broker);
  const index = next.findIndex((item) => item.platform === platform);
  const currentAmount = index === -1 ? 0 : Number(next[index].amount || 0);
  const delta = trade.side === "매수" ? -(trade.amount + trade.fee) : trade.amount - trade.fee;
  const nextAmount = normalizeMoney(currentAmount + delta);

  if (index === -1) {
    next.push({
      platform,
      amount: nextAmount,
    });
  } else {
    next[index] = {
      ...next[index],
      amount: nextAmount,
    };
  }

  return sortCashPositions(next);
}

function revalueHoldings(holdings, analytics) {
  return holdings
    .filter((item) => Number(item.quantity) > 0)
    .map((item) => {
      const principal = normalizeMoney(item.quantity * item.averagePrice);
      const valuation = normalizeMoney(item.quantity * getAssetPrice(analytics, item.asset, item.averagePrice));
      const pnl = normalizeMoney(valuation - principal);

      return normalizeHoldingMetadata({
        ...item,
        quantity: normalizeQuantity(item.quantity),
        averagePrice: normalizeMoney(item.averagePrice),
        valuation,
        returnRate: principal ? normalizeRate(pnl / principal) : 0,
      });
    })
    .sort((left, right) => right.valuation - left.valuation || left.platform.localeCompare(right.platform, "ko"));
}

function buildRealizedEntry(trade, basis) {
  const parsed = parseProfitNote(trade.note);
  const overridePnl = Number.isFinite(Number(trade.realizedPnlOverride)) ? normalizeMoney(Number(trade.realizedPnlOverride)) : null;
  const overrideReturnRate =
    Number.isFinite(Number(trade.realizedReturnRateOverride)) ? normalizeRate(Number(trade.realizedReturnRateOverride)) : null;
  const pnl = overridePnl ?? (parsed ? parsed.pnl : normalizeMoney(trade.amount - trade.fee - basis));
  const returnRate = overrideReturnRate ?? (parsed && parsed.returnRate != null ? parsed.returnRate : basis ? normalizeRate(pnl / basis) : 0);
  const unit = trade.market === "암호화폐" ? "개" : "주";

  return {
    market: trade.market,
    platform: trade.broker,
    asset: `${trade.asset} ${formatQuantityForLabel(trade.quantity)}${unit} 매도`,
    assetName: trade.asset,
    symbol: trade.symbol || "",
    quantity: normalizeQuantity(trade.quantity),
    pnl,
    returnRate,
    date: trade.date,
  };
}

function getHoldingMetadataFromTrade(trade) {
  if (trade.market === "암호화폐") {
    return {
      market: "crypto",
      currency: "KRW",
      priceSource: "upbit",
      symbol:
        trade.symbol ||
        (trade.asset === "비트코인" || trade.asset === "BTC"
          ? "KRW-BTC"
          : trade.asset === "ETH"
            ? "KRW-ETH"
            : trade.asset === "XRP"
              ? "KRW-XRP"
              : ""),
    };
  }

  if (trade.market === "미국주식") {
    return {
      market: "us-stock",
      currency: "USD",
      priceSource: "twelve-data",
      symbol: trade.symbol || (/^[A-Z.\-]+$/.test(String(trade.asset || "").trim()) ? String(trade.asset).trim() : ""),
    };
  }

  return {
    market: "kr-stock",
    currency: "KRW",
    priceSource: "kis",
    symbol: trade.symbol || "",
  };
}

function applyTradeToHoldings(holdings, trade, analytics) {
  const next = holdings.map((item) => ({ ...item }));
  const platform = trade.market === "암호화폐" ? "업비트" : trade.broker;
  const tradeMetadata = getHoldingMetadataFromTrade(trade);
  const index = next.findIndex(
    (item) =>
      item.platform === platform &&
      ((tradeMetadata.symbol && item.symbol === tradeMetadata.symbol) || item.asset === trade.asset)
  );
  const currentHolding =
    index === -1
      ? normalizeHoldingMetadata({
          platform,
          asset: trade.asset,
          ...tradeMetadata,
          quantity: 0,
          averagePrice: 0,
          valuation: 0,
          returnRate: 0,
        })
      : {
          ...next[index],
          ...((!next[index].market || !next[index].symbol || !next[index].priceSource) ? tradeMetadata : {}),
        };

  const currentPrincipal = normalizeMoney(currentHolding.quantity * currentHolding.averagePrice);
  let realizedEntry = null;

  if (trade.side === "매수") {
    const nextQuantity = normalizeQuantity(currentHolding.quantity + trade.quantity);
    const nextPrincipal = normalizeMoney(currentPrincipal + trade.amount + trade.fee);
    currentHolding.quantity = nextQuantity;
    currentHolding.averagePrice = nextQuantity ? normalizeMoney(nextPrincipal / nextQuantity) : 0;
  } else {
    if (trade.quantity > currentHolding.quantity + 1e-8) {
      throw new Error(`${trade.asset} 보유수량이 부족합니다.`);
    }

    const averagePrice = currentHolding.quantity ? currentPrincipal / currentHolding.quantity : 0;
    const basis = normalizeMoney(averagePrice * trade.quantity);
    const nextQuantity = normalizeQuantity(currentHolding.quantity - trade.quantity);
    const nextPrincipal = normalizeMoney(currentPrincipal - basis);

    currentHolding.quantity = nextQuantity;
    currentHolding.averagePrice = nextQuantity ? normalizeMoney(nextPrincipal / nextQuantity) : 0;
    realizedEntry = buildRealizedEntry(trade, basis);
  }

  if (currentHolding.quantity > 0) {
    if (index === -1) {
      next.push(currentHolding);
    } else {
      next[index] = currentHolding;
    }
  } else if (index !== -1) {
    next.splice(index, 1);
  }

  return {
    holdings: revalueHoldings(next, analytics),
    realizedEntry,
  };
}

function rebuildAssetStatus(holdings) {
  const groups = new Map();

  holdings.forEach((item) => {
    const category = resolveAssetCategory(item);
    const key = `${category}::${item.platform}`;
    if (!groups.has(key)) {
      groups.set(key, {
        category,
        platform: item.platform,
        valuation: 0,
        principal: 0,
        pnl: 0,
        returnRate: 0,
      });
    }

    const bucket = groups.get(key);
    const principal = normalizeMoney(item.quantity * item.averagePrice);
    bucket.valuation += item.valuation;
    bucket.principal += principal;
    bucket.pnl += item.valuation - principal;
  });

  return [...groups.values()]
    .map((item) => ({
      ...item,
      valuation: normalizeMoney(item.valuation),
      principal: normalizeMoney(item.principal),
      pnl: normalizeMoney(item.pnl),
      returnRate: item.principal ? normalizeRate(item.pnl / item.principal) : 0,
    }))
    .sort((left, right) => {
      const categoryOrder = { 암호화폐: 0, 해외주식: 1, 국내주식: 2 };
      const categoryDelta = (categoryOrder[left.category] ?? 99) - (categoryOrder[right.category] ?? 99);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }

      return left.platform.localeCompare(right.platform, "ko");
    });
}

function rebuildSummary(previousSummary, assetStatus, cashPositions, realized, metadata = {}) {
  const assetValuationTotal = normalizeMoney(assetStatus.reduce((total, item) => total + item.valuation, 0));
  const investedPrincipal = normalizeMoney(assetStatus.reduce((total, item) => total + item.principal, 0));
  const portfolioPnl = normalizeMoney(assetStatus.reduce((total, item) => total + item.pnl, 0));
  const cashTotal = normalizeMoney(cashPositions.reduce((total, item) => total + Number(item.amount || 0), 0));
  const totalAssets = normalizeMoney(assetValuationTotal + cashTotal);
  const realizedForPerformance = filterRealizedForPerformance(
    realized,
    metadata?.basisDateLabel,
    metadata?.realizedPerformanceStartDate
  );
  const realizedProfitTotal = normalizeMoney(realizedForPerformance.reduce((total, item) => total + Number(item.pnl || 0), 0));

  return {
    initialInvestment: previousSummary.initialInvestment,
    totalAssets,
    investedPrincipal,
    assetValuationTotal,
    cashTotal,
    portfolioPnl,
    portfolioReturnRate: investedPrincipal ? normalizeRate(portfolioPnl / investedPrincipal) : 0,
    realizedProfitTotal,
    liquidityRatio: totalAssets ? normalizeRate(cashTotal / totalAssets) : 0,
  };
}

function realizedSortValue(item, year) {
  return toTradeDate(item.date, year).getTime();
}

function sortRealized(realized, basisLabel) {
  const year = parseBasisYear(basisLabel);
  return [...realized].sort((left, right) => realizedSortValue(right, year) - realizedSortValue(left, year));
}

function buildChartData({ basisDateLabel, performanceStartDate, holdings, realized }) {
  const year = parseBasisYear(basisDateLabel);
  const performanceRealized = filterRealizedForPerformance(realized, basisDateLabel, performanceStartDate);
  const returnsByAsset = new Map();

  holdings.forEach((item) => {
    if (!item.quantity || !item.valuation) {
      return;
    }

    const principal = normalizeMoney(item.quantity * item.averagePrice);
    if (!returnsByAsset.has(item.asset)) {
      returnsByAsset.set(item.asset, {
        label: item.asset,
        valuation: 0,
        principal: 0,
      });
    }

    const bucket = returnsByAsset.get(item.asset);
    bucket.valuation += item.valuation;
    bucket.principal += principal;
  });

  const returnsComparison = [...returnsByAsset.values()]
    .map((item) => {
      const valuation = normalizeMoney(item.valuation);
      const principal = normalizeMoney(item.principal);
      const pnl = normalizeMoney(valuation - principal);
      return {
        label: item.label,
        valuation,
        pnl,
        returnRate: principal ? normalizeRate(pnl / principal) : 0,
      };
    })
    .sort((left, right) => right.returnRate - left.returnRate);

  const realizedPoints = performanceRealized
    .map((item, index) => {
      const quantity = item.quantity || 0;
      const unit = item.platform === "업비트" ? "개" : "주";
      const detailLabel = `${item.assetName || item.asset} ${formatQuantityForLabel(quantity)}${unit} · ${item.platform}`;
      const tradeDate = toTradeDate(item.date, year);

      return {
        ...item,
        quantity,
        order: index,
        detailLabel,
        sortValue: tradeDate.getTime(),
        displayDate: `${tradeDate.getFullYear()}-${String(tradeDate.getMonth() + 1).padStart(2, "0")}-${String(
          tradeDate.getDate()
        ).padStart(2, "0")}`,
      };
    })
    .sort((left, right) => left.sortValue - right.sortValue || left.order - right.order);

  const realizedHistory = [];
  let cumulativePnl = 0;

  realizedPoints.forEach((item) => {
    cumulativePnl = normalizeMoney(cumulativePnl + item.pnl);

    const existing = realizedHistory[realizedHistory.length - 1];
    if (existing && existing.date === item.date) {
      existing.dailyPnl = normalizeMoney(existing.dailyPnl + item.pnl);
      existing.cumulativePnl = cumulativePnl;
      existing.tradeCount += 1;
      existing.items.push(item.detailLabel);
      existing.profitDetails.push({
        item: item.detailLabel,
        pnl: item.pnl,
        ...(item.note ? { note: item.note } : {}),
      });
      return;
    }

    realizedHistory.push({
      date: item.date,
      displayDate: item.displayDate,
      dailyPnl: item.pnl,
      cumulativePnl,
      tradeCount: 1,
      items: [item.detailLabel],
      profitDetails: [
        {
          item: item.detailLabel,
          pnl: item.pnl,
          ...(item.note ? { note: item.note } : {}),
        },
      ],
    });
  });

  return {
    returnsComparison,
    realizedHistory,
  };
}

function updateBasisDateLabel(metadata, trade) {
  const basis = parseBasisDateLabel(metadata.basisDateLabel);
  const year = basis?.year || parseBasisYear(metadata.basisDateLabel);
  const currentBasis = basis ? new Date(basis.year, basis.month - 1, basis.day) : new Date(year, 0, 1);
  const tradeDate = toTradeDate(trade.date, year);

  if (compareDateOnly(tradeDate, currentBasis) > 0) {
    metadata.basisDateLabel = formatBasisDateLabel(year, tradeDate.getMonth() + 1, tradeDate.getDate());
    return true;
  }

  return compareDateOnly(tradeDate, currentBasis) === 0;
}

function updateXrpDefense(xrpDefense, holdings, trade, realizedEntry) {
  if (!xrpDefense) {
    return xrpDefense;
  }

  const next = { ...xrpDefense };
  const xrpHolding = holdings.find((item) => item.platform === "업비트" && item.asset === "XRP");

  if (trade.broker === "업비트" && trade.asset === "XRP") {
    if (trade.side === "매수") {
      const previousQuantity = Number(next.rebuyQuantity || 0);
      const previousCost = previousQuantity * Number(next.averageRebuyGross || 0);
      const nextQuantity = normalizeQuantity(previousQuantity + trade.quantity);
      const nextCost = normalizeMoney(previousCost + trade.amount + trade.fee);
      next.rebuyQuantity = nextQuantity;
      next.averageRebuyGross = nextQuantity ? normalizeMoney(nextCost / nextQuantity) : 0;
    } else {
      const previousQuantity = Number(next.soldQuantity || 0);
      const previousRevenue = previousQuantity * Number(next.averageSellNet || 0);
      const saleNet = normalizeMoney(trade.amount - trade.fee);
      const nextQuantity = normalizeQuantity(previousQuantity + trade.quantity);
      const nextRevenue = normalizeMoney(previousRevenue + saleNet);

      next.soldQuantity = nextQuantity;
      next.averageSellNet = nextQuantity ? normalizeMoney(nextRevenue / nextQuantity) : 0;

      if (realizedEntry) {
        next.defenseGain = normalizeMoney(Number(next.defenseGain || 0) + realizedEntry.pnl);
        next.realizedPnl = normalizeMoney(Number(next.realizedPnl || 0) + realizedEntry.pnl);
      }
    }
  }

  next.remainingQuantity = normalizeQuantity(xrpHolding?.quantity || 0);
  next.finalAveragePrice = normalizeMoney(xrpHolding?.averagePrice || 0);
  next.averageCutAmount = normalizeMoney(Number(next.initialAveragePrice || 0) - Number(next.finalAveragePrice || 0));
  next.averageCutRate = next.initialAveragePrice
    ? normalizeRate(next.averageCutAmount / Number(next.initialAveragePrice))
    : 0;

  return next;
}

function appendTrade(portfolio, trade) {
  const next = structuredClone(portfolio);
  const collectionKey = getTradeCollectionKey(trade);
  const tradePayload = buildTradePayload(trade);

  next.trades[collectionKey] = [...next.trades[collectionKey], tradePayload];

  const isLatestPrice = updateBasisDateLabel(next.metadata, trade);
  if (isLatestPrice) {
    updateAssetPrice(next.analytics, trade.asset, trade.price);
  }

  next.cashPositions = applyTradeToCashPositions(next.cashPositions, trade);

  const holdingUpdate = applyTradeToHoldings(next.holdings, trade, next.analytics);
  next.holdings = holdingUpdate.holdings;
  if (holdingUpdate.realizedEntry) {
    next.realized = sortRealized([...next.realized, holdingUpdate.realizedEntry], next.metadata.basisDateLabel);
  }

  next.assetStatus = rebuildAssetStatus(next.holdings);
  next.summary = rebuildSummary(next.summary, next.assetStatus, next.cashPositions, next.realized, next.metadata);
  next.charts = buildChartData({
    basisDateLabel: next.metadata.basisDateLabel,
    performanceStartDate: next.metadata.realizedPerformanceStartDate,
    holdings: next.holdings,
    realized: next.realized,
  });
  next.analytics.xrpDefense = updateXrpDefense(next.analytics.xrpDefense, next.holdings, trade, holdingUpdate.realizedEntry);

  return next;
}

function buildTradePayload(trade) {
  return {
    date: trade.date,
    market: trade.market,
    ...(trade.broker ? { broker: trade.broker } : {}),
    asset: trade.asset,
    ...(trade.symbol ? { symbol: trade.symbol } : {}),
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    amount: trade.amount,
    fee: trade.fee,
    ...(trade.stage ? { stage: trade.stage } : {}),
    ...(trade.strategyBaselineQuantity != null ? { strategyBaselineQuantity: trade.strategyBaselineQuantity } : {}),
    ...(trade.realizedPnlOverride != null ? { realizedPnlOverride: trade.realizedPnlOverride } : {}),
    ...(trade.realizedReturnRateOverride != null ? { realizedReturnRateOverride: trade.realizedReturnRateOverride } : {}),
    ...(trade.realizedReferencePrice != null ? { realizedReferencePrice: trade.realizedReferencePrice } : {}),
    ...(trade.note ? { note: trade.note } : {}),
    ...(trade.createdAt ? { createdAt: trade.createdAt } : {}),
    ...(trade.updatedAt ? { updatedAt: trade.updatedAt } : {}),
  };
}

function buildTradeMutationMatchSnapshot(input = {}) {
  const match = {};
  const createdAt = normalizeStoredTimestamp(input.createdAt);
  const date = String(input.date || "").trim();
  const market = String(input.market || "").trim();
  const broker = String(input.broker || "").trim();
  const asset = String(input.asset || "").trim();
  const symbol = String(input.symbol || "").trim().toUpperCase();
  const side = String(input.side || "").trim();
  const quantity = Number(input.quantity);
  const price = Number(input.price);

  if (createdAt) {
    match.createdAt = createdAt;
  }
  if (date) {
    match.date = date;
  }
  if (market) {
    match.market = market;
  }
  if (broker) {
    match.broker = broker;
  }
  if (asset) {
    match.asset = asset;
  }
  if (symbol) {
    match.symbol = symbol;
  }
  if (side) {
    match.side = side;
  }
  if (Number.isFinite(quantity)) {
    match.quantity = normalizeQuantity(quantity);
  }
  if (Number.isFinite(price)) {
    match.price = normalizeMoney(price);
  }

  return Object.keys(match).length ? match : null;
}

function matchesTradeMutationMatch(trade = {}, match = null) {
  if (!match || typeof match !== "object") {
    return false;
  }

  return Object.entries(match).every(([key, expected]) => {
    if (typeof expected === "number") {
      const candidate = Number(trade?.[key]);
      return Number.isFinite(candidate) && Math.abs(candidate - expected) < 1e-9;
    }

    const candidate =
      key === "createdAt"
        ? normalizeStoredTimestamp(trade?.[key])
        : key === "symbol"
          ? String(trade?.[key] || "").trim().toUpperCase()
          : String(trade?.[key] || "").trim();

    return candidate === expected;
  });
}

function resolveTradeMutationIndex(trades = [], selector = {}, options = {}) {
  const missingMessage = String(options.missingMessage || "거래를 찾지 못했습니다.");
  const ambiguousMessage = String(options.ambiguousMessage || "동일한 거래가 여러 개라 다시 시도해주세요.");
  const hasIndex = Number.isInteger(selector.index) && selector.index >= 0;
  const match = selector.match;

  if (hasIndex) {
    const indexedTrade = trades[selector.index];
    if (indexedTrade && (!match || matchesTradeMutationMatch(indexedTrade, match))) {
      return selector.index;
    }
  }

  if (match) {
    const matchedIndexes = [];
    trades.forEach((trade, index) => {
      if (matchesTradeMutationMatch(trade, match)) {
        matchedIndexes.push(index);
      }
    });

    if (matchedIndexes.length === 1) {
      return matchedIndexes[0];
    }

    if (matchedIndexes.length > 1) {
      if (hasIndex && matchedIndexes.includes(selector.index)) {
        return selector.index;
      }
      throw new Error(ambiguousMessage);
    }
  }

  if (!match && hasIndex && trades[selector.index]) {
    return selector.index;
  }

  throw new Error(missingMessage);
}

function getCurrentHoldingQuantityForTrade(portfolio, trade) {
  const holdings = Array.isArray(portfolio?.holdings) ? portfolio.holdings : [];
  const platform = trade.market === "암호화폐" ? "업비트" : trade.broker;
  const tradeMetadata = getHoldingMetadataFromTrade(trade);
  const matchedHolding = holdings.find(
    (item) =>
      item.platform === platform &&
      ((tradeMetadata.symbol && item.symbol === tradeMetadata.symbol) || item.asset === trade.asset)
  );
  return normalizeQuantity(Number(matchedHolding?.quantity || 0));
}

function attachStrategyBaselineToTrade(portfolio, trade, originalTrade = null) {
  if (!isSellStrategyStageValue(trade?.stage)) {
    return {
      ...trade,
      strategyBaselineQuantity: null,
    };
  }

  const explicitBaseline = normalizeStrategyBaselineQuantity(trade.strategyBaselineQuantity);
  if (explicitBaseline != null) {
    return {
      ...trade,
      strategyBaselineQuantity: explicitBaseline,
    };
  }

  const preservedBaseline = normalizeStrategyBaselineQuantity(originalTrade?.strategyBaselineQuantity);
  if (preservedBaseline != null) {
    return {
      ...trade,
      strategyBaselineQuantity: preservedBaseline,
    };
  }

  const currentHoldingQuantity = getCurrentHoldingQuantityForTrade(portfolio, trade);
  const fallbackBaseline =
    originalTrade
      ? currentHoldingQuantity
      : trade.side === "매수"
        ? normalizeQuantity(currentHoldingQuantity + trade.quantity)
        : currentHoldingQuantity;
  const nextBaseline = normalizeStrategyBaselineQuantity(fallbackBaseline);

  return nextBaseline != null
    ? {
        ...trade,
        strategyBaselineQuantity: nextBaseline,
      }
    : {
        ...trade,
        strategyBaselineQuantity: null,
      };
}

function hydrateStoredTradeRecord(record, fallbackMarket, basisLabel) {
  return normalizeTradeInput(
    {
      ...record,
      market: record.market || fallbackMarket,
      broker: record.broker || (fallbackMarket === "암호화폐" ? "업비트" : ""),
    },
    basisLabel,
    { allowPastDate: true, autoTimestamp: false }
  );
}

function buildTradeBook(portfolio) {
  const basisLabel = portfolio.metadata?.basisDateLabel || `${new Date().getFullYear()}.01.01 기준`;
  const realizedPool = [...(portfolio.realized || [])];
  const hydrateWithOverrides = (trade, fallbackMarket) => {
    const hydrated = hydrateStoredTradeRecord(trade, fallbackMarket, basisLabel);
    if (hydrated.side !== "매도") {
      return hydrated;
    }

    const realizedIndex = findMatchingRealizedEntryIndex(realizedPool, hydrated);
    if (realizedIndex === -1) {
      return hydrated;
    }

    const realizedEntry = realizedPool.splice(realizedIndex, 1)[0];
    return {
      ...hydrated,
      realizedPnlOverride: Number.isFinite(Number(realizedEntry.pnl)) ? normalizeMoney(Number(realizedEntry.pnl)) : null,
      realizedReturnRateOverride:
        Number.isFinite(Number(realizedEntry.returnRate)) ? normalizeRate(Number(realizedEntry.returnRate)) : null,
    };
  };

  return {
    stocks: (Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : []).map((trade) =>
      hydrateWithOverrides(trade, trade.market || "국내주식")
    ),
    crypto: (Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : []).map((trade) =>
      hydrateWithOverrides(trade, "암호화폐")
    ),
  };
}

function reverseTradeOnCashPositions(cashPositions, trade) {
  const next = cashPositions.map((item) => ({ ...item }));
  const platform = getCashPlatformName(trade.broker);
  const index = next.findIndex((item) => item.platform === platform);
  const currentAmount = index === -1 ? 0 : Number(next[index].amount || 0);
  const delta = trade.side === "매수" ? trade.amount + trade.fee : -(trade.amount - trade.fee);
  const nextAmount = normalizeMoney(currentAmount + delta);

  if (index === -1) {
    next.push({
      platform,
      amount: nextAmount,
    });
  } else {
    next[index] = {
      ...next[index],
      amount: nextAmount,
    };
  }

  return sortCashPositions(next);
}

function findMatchingRealizedEntryIndex(realized, trade) {
  return realized.findIndex((item) => {
    const platformMatches = String(item.platform || "").trim() === String(trade.broker || "").trim();
    const marketMatches =
      !item.market || !trade.market ? true : String(item.market || "").trim() === String(trade.market || "").trim();
    const dateMatches = String(item.date || "").trim() === String(trade.date || "").trim();
    const assetMatches =
      normalizeAssetNameForMatching(item.assetName || item.asset, item.market) === normalizeAssetNameForMatching(trade.asset, trade.market);
    const symbolMatches =
      normalizeMatchingText(item.symbol) && normalizeMatchingText(item.symbol) === normalizeMatchingText(trade.symbol);
    const quantityMatches = Math.abs(Number(item.quantity || 0) - Number(trade.quantity || 0)) < 1e-8;
    return platformMatches && marketMatches && dateMatches && quantityMatches && (symbolMatches || assetMatches);
  });
}

function reverseTradeOnHoldings(holdings, trade, analytics, realizedPool = []) {
  const next = holdings.map((item) => ({ ...item }));
  const nextRealized = [...realizedPool];
  const platform = trade.market === "암호화폐" ? "업비트" : trade.broker;
  const tradeMetadata = getHoldingMetadataFromTrade(trade);
  const index = next.findIndex(
    (item) =>
      item.platform === platform &&
      ((tradeMetadata.symbol && item.symbol === tradeMetadata.symbol) || item.asset === trade.asset)
  );
  const currentHolding =
    index === -1
      ? normalizeHoldingMetadata({
          platform,
          asset: trade.asset,
          ...tradeMetadata,
          quantity: 0,
          averagePrice: 0,
          valuation: 0,
          returnRate: 0,
        })
      : {
          ...next[index],
          ...((!next[index].market || !next[index].symbol || !next[index].priceSource) ? tradeMetadata : {}),
        };

  if (trade.side === "매수") {
    if (trade.quantity > currentHolding.quantity + 1e-8) {
      throw new Error(`${trade.asset} 매수 거래를 되돌릴 보유수량이 부족합니다.`);
    }

    const currentPrincipal = normalizeMoney(currentHolding.quantity * currentHolding.averagePrice);
    const previousQuantity = normalizeQuantity(currentHolding.quantity - trade.quantity);
    const previousPrincipal = normalizeMoney(currentPrincipal - trade.amount - trade.fee);

    currentHolding.quantity = previousQuantity;
    currentHolding.averagePrice = previousQuantity ? normalizeMoney(previousPrincipal / previousQuantity) : 0;
  } else {
    let averagePrice = normalizeMoney(currentHolding.averagePrice || 0);

    if (!(averagePrice > 0)) {
      const realizedIndex = findMatchingRealizedEntryIndex(nextRealized, trade);
      const realizedEntry = realizedIndex === -1 ? null : nextRealized[realizedIndex];
      if (realizedIndex !== -1) {
        nextRealized.splice(realizedIndex, 1);
      }

      if (realizedEntry) {
        const basis = normalizeMoney(trade.amount - trade.fee - Number(realizedEntry.pnl || 0));
        averagePrice = trade.quantity ? normalizeMoney(basis / trade.quantity) : 0;
      }
    } else {
      const realizedIndex = findMatchingRealizedEntryIndex(nextRealized, trade);
      if (realizedIndex !== -1) {
        nextRealized.splice(realizedIndex, 1);
      }
    }

    if (!(averagePrice > 0)) {
      throw new Error(`${trade.asset} 매도 거래를 되돌릴 평균단가를 찾지 못했습니다.`);
    }

    currentHolding.quantity = normalizeQuantity(currentHolding.quantity + trade.quantity);
    currentHolding.averagePrice = averagePrice;
  }

  if (currentHolding.quantity > 0) {
    if (index === -1) {
      next.push(currentHolding);
    } else {
      next[index] = currentHolding;
    }
  } else if (index !== -1) {
    next.splice(index, 1);
  }

  return {
    holdings: revalueHoldings(next, analytics),
    realized: nextRealized,
  };
}

function createRebuildSeedPortfolio(portfolio) {
  const year = parseBasisYear(portfolio.metadata?.basisDateLabel);
  const xrpDefense = portfolio.analytics?.xrpDefense || {};
  const tradeBook = buildTradeBook(portfolio);
  let holdings = (portfolio.holdings || []).map((item) => normalizeHoldingMetadata(item));
  let cashPositions = sortCashPositions((portfolio.cashPositions || []).map((item) => ({ ...item })));
  let realizedPool = sortRealized([...(portfolio.realized || [])], portfolio.metadata?.basisDateLabel || `${year}.01.01 기준`);

  [...tradeBook.stocks].reverse().forEach((trade) => {
    cashPositions = reverseTradeOnCashPositions(cashPositions, trade);
    const reversed = reverseTradeOnHoldings(holdings, trade, portfolio.analytics || {}, realizedPool);
    holdings = reversed.holdings;
    realizedPool = reversed.realized;
  });

  [...tradeBook.crypto].reverse().forEach((trade) => {
    cashPositions = reverseTradeOnCashPositions(cashPositions, trade);
    const reversed = reverseTradeOnHoldings(holdings, trade, portfolio.analytics || {}, realizedPool);
    holdings = reversed.holdings;
    realizedPool = reversed.realized;
  });

  const basisDateLabel = `${year}.01.01 기준`;
  const assetStatus = rebuildAssetStatus(holdings);
  const summary = rebuildSummary(portfolio.summary, assetStatus, cashPositions, [], portfolio.metadata);
  return {
    ...structuredClone(portfolio),
    metadata: {
      ...structuredClone(portfolio.metadata || {}),
      basisDateLabel,
    },
    trades: {
      stocks: [],
      crypto: [],
    },
    realized: [],
    holdings,
    cashPositions,
    assetStatus,
    summary,
    charts: buildChartData({
      basisDateLabel,
      performanceStartDate: portfolio.metadata?.realizedPerformanceStartDate,
      holdings,
      realized: [],
    }),
    analytics: {
      ...structuredClone(portfolio.analytics || {}),
      xrpDefense: xrpDefense
        ? {
            ...structuredClone(xrpDefense),
            soldQuantity: 0,
            averageSellNet: 0,
            rebuyQuantity: 0,
            averageRebuyGross: 0,
            defenseGain: 0,
            realizedPnl: 0,
            remainingQuantity: normalizeQuantity(Number(xrpDefense.initialQuantity || 0)),
            finalAveragePrice: normalizeMoney(Number(xrpDefense.initialAveragePrice || 0)),
            averageCutAmount: 0,
            averageCutRate: 0,
            breakevenTargetBuyPrice: 0,
          }
        : xrpDefense,
    },
  };
}

function rebuildPortfolioFromTradeBook(portfolio, tradeBook) {
  const seed = createRebuildSeedPortfolio(portfolio);
  let next = seed;

  tradeBook.stocks.forEach((trade) => {
    next = appendTrade(next, trade);
  });

  tradeBook.crypto.forEach((trade) => {
    next = appendTrade(next, trade);
  });

  const hasRemainingTrades =
    (Array.isArray(tradeBook?.stocks) && tradeBook.stocks.length > 0) ||
    (Array.isArray(tradeBook?.crypto) && tradeBook.crypto.length > 0);

  if (!hasRemainingTrades) {
    const preservedBasisDateLabel = String(portfolio?.metadata?.basisDateLabel || "").trim();
    if (preservedBasisDateLabel) {
      next.metadata = {
        ...(next.metadata || {}),
        basisDateLabel: preservedBasisDateLabel,
      };
      next.charts = buildChartData({
        basisDateLabel: preservedBasisDateLabel,
        performanceStartDate: next.metadata?.realizedPerformanceStartDate,
        holdings: next.holdings || [],
        realized: next.realized || [],
      });
    }
  }

  return next;
}

async function loadPortfolio(rootDir) {
  const filePath = path.join(rootDir, buildLocalPortfolioPath("owner"));
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
    return structuredClone(getBundledPortfolioData());
  }
}

function buildBackupFilename() {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  return `portfolio-${timestamp}.json`;
}

async function backupExistingPortfolio(rootDir, jsonPath) {
  try {
    await fs.access(jsonPath);
  } catch {
    return;
  }

  const backupDir = path.join(rootDir, "data", "backups");
  await fs.mkdir(backupDir, { recursive: true });
  await fs.copyFile(jsonPath, path.join(backupDir, buildBackupFilename()));

  const entries = await fs.readdir(backupDir, { withFileTypes: true });
  const backupFiles = entries
    .filter((entry) => entry.isFile() && entry.name.startsWith("portfolio-") && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort()
    .reverse();

  const staleBackups = backupFiles.slice(BACKUP_LIMIT);
  await Promise.all(
    staleBackups.map((fileName) => fs.unlink(path.join(backupDir, fileName)))
  );
}

async function savePortfolio(rootDir, portfolio) {
  const payload = JSON.stringify(portfolio, null, 2);
  const jsonPath = path.join(rootDir, buildLocalPortfolioPath("owner"));

  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await backupExistingPortfolio(rootDir, jsonPath);
  await fs.writeFile(jsonPath, `${payload}\n`, "utf8");
}

async function addTrade(rootDir, input) {
  const portfolio = await loadPortfolio(rootDir);
  const trade = attachStrategyBaselineToTrade(
    portfolio,
    normalizeTradeInput(input, portfolio.metadata.basisDateLabel)
  );
  const updated = appendTrade(portfolio, trade);
  await savePortfolio(rootDir, updated);
  return updated;
}

function normalizeTradeMutationSelector(input = {}, trades = null, options = {}) {
  const collection = String(input.collection || "").trim();
  const index = Number(input.index);
  const hasIndex = Number.isInteger(index) && index >= 0;
  const match = buildTradeMutationMatchSnapshot(input.match || input.tradeMatch || input.originalTrade || {});

  if (!["stocks", "crypto"].includes(collection)) {
    throw new Error("거래 수정 대상 컬렉션을 확인하세요.");
  }

  if (!hasIndex && !match) {
    throw new Error("거래 수정 대상을 확인하세요.");
  }

  const selector = {
    collection,
    index: hasIndex ? index : null,
    match,
  };

  if (!Array.isArray(trades)) {
    return selector;
  }

  return {
    ...selector,
    index: resolveTradeMutationIndex(trades, selector, options),
  };
}

async function updateTrade(rootDir, input = {}) {
  const portfolio = await loadPortfolio(rootDir);
  const selector = normalizeTradeMutationSelector(input);
  const tradeCollections = {
    stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
    crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
  };
  const tradeIndex = resolveTradeMutationIndex(tradeCollections[selector.collection], selector, {
    missingMessage: "수정할 거래를 찾지 못했습니다.",
    ambiguousMessage: "수정할 거래가 여러 개라 다시 불러온 뒤 다시 시도해주세요.",
  });
  const originalTrade = tradeCollections[selector.collection][tradeIndex];

  if (!originalTrade) {
    throw new Error("수정할 거래를 찾지 못했습니다.");
  }

  const market = originalTrade.market || (selector.collection === "crypto" ? "암호화폐" : "국내주식");
  const tradePatch = input.trade || {};
  const hasPatchedAmount = Object.prototype.hasOwnProperty.call(tradePatch, "amount");
  const hasPatchedFee = Object.prototype.hasOwnProperty.call(tradePatch, "fee");
  const updatedTrade = normalizeTradeInput(
    {
      ...originalTrade,
      ...tradePatch,
      market,
      amount: hasPatchedAmount ? tradePatch.amount : originalTrade.amount,
      fee: hasPatchedFee ? tradePatch.fee : originalTrade.fee,
    },
    portfolio.metadata.basisDateLabel,
    { allowPastDate: true, autoTimestamp: false, touchUpdatedAt: true }
  );
  const tradeWithStrategyBaseline = attachStrategyBaselineToTrade(portfolio, updatedTrade, originalTrade);

  tradeCollections[selector.collection][tradeIndex] = buildTradePayload(tradeWithStrategyBaseline);
  const rebuilt = rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  await savePortfolio(rootDir, rebuilt);
  return rebuilt;
}

async function removeTrade(rootDir, input = {}) {
  const portfolio = await loadPortfolio(rootDir);
  const selector = normalizeTradeMutationSelector(input);
  const tradeCollections = {
    stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
    crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
  };
  const tradeIndex = resolveTradeMutationIndex(tradeCollections[selector.collection], selector, {
    missingMessage: "삭제할 거래를 찾지 못했습니다.",
    ambiguousMessage: "삭제할 거래가 여러 개라 다시 불러온 뒤 다시 시도해주세요.",
  });

  if (!tradeCollections[selector.collection][tradeIndex]) {
    throw new Error("삭제할 거래를 찾지 못했습니다.");
  }

  tradeCollections[selector.collection].splice(tradeIndex, 1);
  const rebuilt = rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  await savePortfolio(rootDir, rebuilt);
  return rebuilt;
}

function upsertManualCashAdjustment(portfolio = {}, input = {}) {
  const next = structuredClone(portfolio || {});
  const normalized = normalizeManualCashAdjustmentInput(input);
  const baseCashPositions = sortCashPositions(
    (Array.isArray(next.cashPositions) ? next.cashPositions : [])
      .filter((item) => String(item?.platform || "").trim() !== MANUAL_CASH_ADJUSTMENT_PLATFORM)
      .map((item) => ({
        platform: String(item?.platform || "").trim(),
        amount: normalizeMoney(Number(item?.amount || 0)),
      }))
      .filter((item) => item.platform)
  );
  const baseCashTotal = normalizeMoney(baseCashPositions.reduce((total, item) => total + Number(item.amount || 0), 0));
  const delta = normalizeMoney(normalized.cashTotal - baseCashTotal);
  const cashPositions =
    delta === 0
      ? baseCashPositions
      : sortCashPositions([
          ...baseCashPositions,
          {
            platform: MANUAL_CASH_ADJUSTMENT_PLATFORM,
            amount: delta,
          },
        ]);

  next.cashPositions = cashPositions;
  next.metadata = {
    ...(next.metadata || {}),
    manualCashAdjustment: {
      targetCashTotal: normalized.cashTotal,
      baseCashTotal,
      delta,
      note: normalized.note,
      updatedAt: new Date().toISOString(),
      active: delta !== 0,
      platform: MANUAL_CASH_ADJUSTMENT_PLATFORM,
    },
  };
  next.summary = rebuildSummary(
    next.summary || { initialInvestment: Number(next?.summary?.initialInvestment || 0) },
    Array.isArray(next.assetStatus) ? next.assetStatus : [],
    next.cashPositions,
    Array.isArray(next.realized) ? next.realized : [],
    next.metadata
  );
  return next;
}

async function addTarget(rootDir, input) {
  const portfolio = await loadPortfolio(rootDir);
  const updated = appendTarget(portfolio, input);
  await savePortfolio(rootDir, updated);
  return updated;
}

async function removeTarget(rootDir, input) {
  const portfolio = await loadPortfolio(rootDir);
  const updated = deleteTarget(portfolio, input);
  await savePortfolio(rootDir, updated);
  return updated;
}

module.exports = {
  addTarget,
  addTrade,
  attachStrategyBaselineToTrade,
  appendTarget,
  appendTrade,
  applyInitialPortfolioSetup,
  buildChartData,
  buildTradeBook,
  deleteStrategyBudget,
  deleteTarget,
  getAssetPrice,
  hasPortfolioContent,
  hydrateStoredTradeRecord,
  loadPortfolio,
  normalizeMoney,
  normalizeInitialSetupInput,
  normalizeManualCashAdjustmentInput,
  normalizeStrategyBudgetDeletionInput,
  normalizeStrategyBudgetInput,
  normalizeTargetDeletionInput,
  normalizeTargetInput,
  normalizeRate,
  normalizeTradeInput,
  normalizeTradeMutationSelector,
  removeTarget,
  removeTrade,
  rebuildAssetStatus,
  rebuildPortfolioFromTradeBook,
  rebuildSummary,
  revalueHoldings,
  reverseTradeOnCashPositions,
  reverseTradeOnHoldings,
  savePortfolio,
  updateTrade,
  updateAssetPrice,
  upsertManualCashAdjustment,
  upsertStrategyBudget,
};
