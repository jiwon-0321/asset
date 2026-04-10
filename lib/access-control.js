const OWNER_ACCESS_CODE = "0321";
const GUEST_ACCESS_CODES = new Set([]);

function normalizeAccessCode(value = "") {
  return String(value || "").trim();
}

function isGuestAccessCode(code) {
  return GUEST_ACCESS_CODES.has(code);
}

function getTodayBasisLabel() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")} 기준`;
}

function buildEmptyPortfolio(template = {}) {
  const next = structuredClone(template || {});

  next.metadata = {
    ...(next.metadata || {}),
    basisDateLabel: getTodayBasisLabel(),
    workbook: "",
  };

  next.summary = {
    initialInvestment: 0,
    totalAssets: 0,
    investedPrincipal: 0,
    assetValuationTotal: 0,
    cashTotal: 0,
    portfolioPnl: 0,
    portfolioReturnRate: 0,
    realizedProfitTotal: 0,
    liquidityRatio: 0,
  };

  next.assetStatus = [];
  next.cashPositions = (Array.isArray(next.cashPositions) ? next.cashPositions : []).map((item) => ({
    ...item,
    amount: 0,
  }));
  next.holdings = [];
  next.realized = [];
  next.trades = {
    stocks: [],
    crypto: [],
  };
  next.charts = {
    returnsComparison: [],
    realizedHistory: [],
  };
  next.targets = {
    ...(next.targets || {}),
    groups: (Array.isArray(next.targets?.groups) ? next.targets.groups : []).map((group) => ({
      ...group,
      items: [],
    })),
  };
  next.analytics = {
    ...(next.analytics || {}),
    prices: {},
    assetPrices: {},
    xrpDefense: {
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
  };

  return next;
}

function resolveAccessProfile(inputCode = "", ownerPortfolio = {}) {
  const code = normalizeAccessCode(inputCode);

  if (code === OWNER_ACCESS_CODE) {
    return {
      ok: true,
      mode: "owner",
      stateKey: "owner",
      code,
      seedPortfolio: structuredClone(ownerPortfolio),
    };
  }

  if (isGuestAccessCode(code)) {
    return {
      ok: true,
      mode: "guest",
      stateKey: `guest-${code.toLowerCase()}`,
      code,
      seedPortfolio: buildEmptyPortfolio(ownerPortfolio),
    };
  }

  return {
    ok: false,
    mode: "unknown",
    stateKey: "",
    code: "",
    seedPortfolio: null,
  };
}

module.exports = {
  GUEST_ACCESS_CODES,
  OWNER_ACCESS_CODE,
  buildEmptyPortfolio,
  normalizeAccessCode,
  resolveAccessProfile,
};
