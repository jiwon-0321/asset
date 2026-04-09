const fs = require("fs/promises");
const path = require("path");

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

const PRICE_KEY_BY_ASSET = {
  삼성전자: "samsungElectronics",
  SK하이닉스: "skHynix",
  XRP: "xrp",
  ETH: "eth",
};

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

function calculateTradeFee({ broker, side, amount }) {
  const rates = {
    업비트: 0.0005,
    카카오증권: 0.00014,
    미래에셋: 0.0001,
  };

  let fee = amount * (rates[broker] || 0);

  if ((broker === "카카오증권" || broker === "미래에셋") && side === "매도") {
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

function normalizeTradeInput(input, basisLabel) {
  const market = String(input.market || "").trim();
  if (!["국내주식", "암호화폐"].includes(market)) {
    throw new Error("시장 값을 확인하세요.");
  }

  const broker = normalizeBrokerName(input.broker || (market === "암호화폐" ? "업비트" : ""));
  if (!broker) {
    throw new Error("플랫폼을 선택하세요.");
  }

  if (market === "국내주식" && broker === "업비트") {
    throw new Error("국내주식 거래는 증권사를 선택하세요.");
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

  if (compareDateOnly(tradeDate, basisDate) < 0) {
    throw new Error("기준일 이전의 과거 거래는 추가할 수 없습니다.");
  }

  const asset = String(input.asset || "").trim();
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
      ? calculateTradeFee({ broker, side, amount })
      : normalizeMoney(Number(input.fee));
  if (!Number.isFinite(fee) || fee < 0) {
    throw new Error("수수료를 확인하세요.");
  }

  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : null;

  return {
    date,
    market,
    broker,
    asset,
    side,
    quantity: normalizeQuantity(quantity),
    price: normalizeMoney(price),
    amount,
    fee,
    note,
  };
}

function getTradeCollectionKey(trade) {
  return trade.market === "국내주식" ? "stocks" : "crypto";
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

      return {
        ...item,
        quantity: normalizeQuantity(item.quantity),
        averagePrice: normalizeMoney(item.averagePrice),
        valuation,
        returnRate: principal ? normalizeRate(pnl / principal) : 0,
      };
    })
    .sort((left, right) => right.valuation - left.valuation || left.platform.localeCompare(right.platform, "ko"));
}

function buildRealizedEntry(trade, basis) {
  const parsed = parseProfitNote(trade.note);
  const pnl = parsed ? parsed.pnl : normalizeMoney(trade.amount - trade.fee - basis);
  const returnRate = parsed && parsed.returnRate != null ? parsed.returnRate : basis ? normalizeRate(pnl / basis) : 0;
  const unit = trade.market === "국내주식" ? "주" : "개";

  return {
    platform: trade.broker,
    asset: `${trade.asset} ${formatQuantityForLabel(trade.quantity)}${unit} 매도`,
    assetName: trade.asset,
    quantity: normalizeQuantity(trade.quantity),
    pnl,
    returnRate,
    date: trade.date,
  };
}

function applyTradeToHoldings(holdings, trade, analytics) {
  const next = holdings.map((item) => ({ ...item }));
  const platform = trade.market === "암호화폐" ? "업비트" : trade.broker;
  const index = next.findIndex((item) => item.platform === platform && item.asset === trade.asset);
  const currentHolding =
    index === -1
      ? {
          platform,
          asset: trade.asset,
          quantity: 0,
          averagePrice: 0,
          valuation: 0,
          returnRate: 0,
        }
      : { ...next[index] };

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
    const category = item.platform === "업비트" ? "암호화폐" : "국내주식";
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
      const categoryOrder = { 암호화폐: 0, 국내주식: 1 };
      const categoryDelta = (categoryOrder[left.category] ?? 99) - (categoryOrder[right.category] ?? 99);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }

      return left.platform.localeCompare(right.platform, "ko");
    });
}

function rebuildSummary(previousSummary, assetStatus, cashPositions, realized) {
  const assetValuationTotal = normalizeMoney(assetStatus.reduce((total, item) => total + item.valuation, 0));
  const investedPrincipal = normalizeMoney(assetStatus.reduce((total, item) => total + item.principal, 0));
  const portfolioPnl = normalizeMoney(assetStatus.reduce((total, item) => total + item.pnl, 0));
  const cashTotal = normalizeMoney(cashPositions.reduce((total, item) => total + Number(item.amount || 0), 0));
  const totalAssets = normalizeMoney(assetValuationTotal + cashTotal);
  const realizedProfitTotal = normalizeMoney(realized.reduce((total, item) => total + Number(item.pnl || 0), 0));

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

function buildChartData({ basisDateLabel, holdings, realized }) {
  const year = parseBasisYear(basisDateLabel);
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

  const realizedPoints = realized
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
  const tradePayload = {
    date: trade.date,
    ...(collectionKey === "stocks" ? { broker: trade.broker } : {}),
    asset: trade.asset,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    amount: trade.amount,
    fee: trade.fee,
    ...(trade.note ? { note: trade.note } : {}),
  };

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
  next.summary = rebuildSummary(next.summary, next.assetStatus, next.cashPositions, next.realized);
  next.charts = buildChartData({
    basisDateLabel: next.metadata.basisDateLabel,
    holdings: next.holdings,
    realized: next.realized,
  });
  next.analytics.xrpDefense = updateXrpDefense(next.analytics.xrpDefense, next.holdings, trade, holdingUpdate.realizedEntry);

  return next;
}

async function loadPortfolio(rootDir) {
  const filePath = path.join(rootDir, "data", "portfolio.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function savePortfolio(rootDir, portfolio) {
  const payload = JSON.stringify(portfolio, null, 2);
  const jsonPath = path.join(rootDir, "data", "portfolio.json");
  const jsPath = path.join(rootDir, "data", "portfolio-data.js");

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

module.exports = {
  addTrade,
  appendTrade,
  buildChartData,
  loadPortfolio,
  normalizeTradeInput,
  savePortfolio,
};
