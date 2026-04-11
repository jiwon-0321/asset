const fs = require("fs/promises");
const path = require("path");
const { normalizeHoldingMetadata, normalizeTargetItem, resolveAssetCategory } = require("../lib/asset-metadata");
const BACKUP_LIMIT = 10;

const quantityFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 8,
});

const BROKER_ALIASES = {
  카카오증권: "카카오증권",
  미래에셋: "미래에셋",
  미래에셋증권: "미래에셋",
  업비트: "업비트",
};

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
];

const ESTIMATED_FEE_RATES = {
  암호화폐: {
    업비트: 0.0005,
  },
  국내주식: {
    카카오증권: 0.00015,
    미래에셋: 0.00014,
  },
  미국주식: {
    카카오증권: 0.001,
    미래에셋: 0.0025,
  },
};

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

function normalizeBrokerName(value) {
  return BROKER_ALIASES[String(value || "").trim()] || String(value || "").trim();
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

function calculateTradeFee({ broker, side, amount, market }) {
  const brokerageRate = ESTIMATED_FEE_RATES?.[market]?.[broker] ?? 0;
  let fee = amount * brokerageRate;

  if (market === "국내주식" && side === "매도") {
    fee += amount * 0.002;
  }

  return normalizeMoney(fee);
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

function normalizeTradeInput(input, basisLabel, options = {}) {
  const allowPastDate = options.allowPastDate === true;
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
      ? calculateTradeFee({ broker, side, amount, market })
      : normalizeMoney(Number(input.fee));
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("수수료를 확인하세요.");
  }

  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : null;
  const stage = normalizeTradeStage(input.stage);

  return {
    date,
    market,
    broker,
    asset,
    symbol: parsedAsset.symbol,
    side,
    quantity: normalizeQuantity(quantity),
    price: normalizeMoney(price),
    amount,
    fee,
    stage,
    note,
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
    priceSource: "",
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

function deleteTarget(portfolio, input) {
  const next = structuredClone(portfolio);
  const normalized = normalizeTargetDeletionInput(input);
  let removed = false;

  const groups = Array.isArray(next.targets?.groups) ? next.targets.groups : [];
  next.targets = {
    ...(next.targets || {}),
    groups: groups.map((group) => {
      const items = Array.isArray(group.items) ? group.items : [];
      const filteredItems = items.filter((item) => {
        const normalizedItem = normalizeTargetItem(item);
        const matchesSymbol = normalized.symbol && normalizedItem.symbol && normalized.symbol === normalizedItem.symbol;
        const matchesName = normalized.name && normalized.name === normalizedItem.name;
        if (matchesSymbol || matchesName) {
          removed = true;
          return false;
        }
        return true;
      });

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
    priceSource: "",
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
    ...(trade.note ? { note: trade.note } : {}),
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
    { allowPastDate: true }
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
    const assetMatches = String(item.assetName || "").trim() === String(trade.asset || "").trim();
    const symbolMatches =
      !trade.symbol || !item.symbol ? true : String(item.symbol || "").trim().toUpperCase() === String(trade.symbol || "").trim().toUpperCase();
    const quantityMatches = Math.abs(Number(item.quantity || 0) - Number(trade.quantity || 0)) < 1e-8;
    return platformMatches && marketMatches && dateMatches && assetMatches && symbolMatches && quantityMatches;
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

  return next;
}

async function loadPortfolio(rootDir) {
  const filePath = path.join(rootDir, "data", "portfolio.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
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
  const jsonPath = path.join(rootDir, "data", "portfolio.json");
  const jsPath = path.join(rootDir, "data", "portfolio-data.js");

  await backupExistingPortfolio(rootDir, jsonPath);
  await fs.writeFile(jsonPath, `${payload}\n`, "utf8");
  await fs.writeFile(jsPath, `window.__PORTFOLIO_DATA__ = ${payload};\n`, "utf8");
}

async function addTrade(rootDir, input) {
  const portfolio = await loadPortfolio(rootDir);
  const trade = normalizeTradeInput(input, portfolio.metadata.basisDateLabel);
  const updated = appendTrade(portfolio, trade);
  await savePortfolio(rootDir, updated);
  return updated;
}

function normalizeTradeMutationSelector(input = {}) {
  const collection = String(input.collection || "").trim();
  const index = Number(input.index);

  if (!["stocks", "crypto"].includes(collection)) {
    throw new Error("거래 수정 대상 컬렉션을 확인하세요.");
  }

  if (!Number.isInteger(index) || index < 0) {
    throw new Error("거래 수정 대상 순서를 확인하세요.");
  }

  return {
    collection,
    index,
  };
}

async function updateTrade(rootDir, input = {}) {
  const portfolio = await loadPortfolio(rootDir);
  const selector = normalizeTradeMutationSelector(input);
  const tradeCollections = {
    stocks: [...(Array.isArray(portfolio.trades?.stocks) ? portfolio.trades.stocks : [])],
    crypto: [...(Array.isArray(portfolio.trades?.crypto) ? portfolio.trades.crypto : [])],
  };
  const originalTrade = tradeCollections[selector.collection][selector.index];

  if (!originalTrade) {
    throw new Error("수정할 거래를 찾지 못했습니다.");
  }

  const market = originalTrade.market || (selector.collection === "crypto" ? "암호화폐" : "국내주식");
  const tradePatch = input.trade || {};
  const updatedTrade = normalizeTradeInput(
    {
      ...originalTrade,
      ...tradePatch,
      market,
      amount: tradePatch.amount,
      fee: tradePatch.fee,
    },
    portfolio.metadata.basisDateLabel,
    { allowPastDate: true }
  );

  tradeCollections[selector.collection][selector.index] = buildTradePayload(updatedTrade);
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

  if (!tradeCollections[selector.collection][selector.index]) {
    throw new Error("삭제할 거래를 찾지 못했습니다.");
  }

  tradeCollections[selector.collection].splice(selector.index, 1);
  const rebuilt = rebuildPortfolioFromTradeBook(portfolio, buildTradeBook({ ...portfolio, trades: tradeCollections }));
  await savePortfolio(rootDir, rebuilt);
  return rebuilt;
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
  appendTarget,
  appendTrade,
  buildChartData,
  buildTradeBook,
  deleteTarget,
  getAssetPrice,
  hydrateStoredTradeRecord,
  loadPortfolio,
  normalizeMoney,
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
};
