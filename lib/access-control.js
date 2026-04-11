const fs = require("fs");
const path = require("path");

const OWNER_ACCESS_CODE_KEYS = ["OWNER_ACCESS_CODE", "ACCESS_CODE"];
const GUEST_ACCESS_CODE_KEYS = ["GUEST_ACCESS_CODES", "GUEST_ACCESS_CODE"];
const OWNER_ACCESS_CODE_MISSING = "owner_code_missing";
const INVALID_ACCESS_CODE = "invalid_code";
let localEnvCache = null;

function normalizeAccessCode(value = "") {
  return String(value || "").trim();
}

function parseEnvContent(content = "") {
  return content.split(/\r?\n/).reduce((env, line) => {
    const trimmed = String(line || "").trim();
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

function readLocalEnv() {
  if (localEnvCache) {
    return localEnvCache;
  }

  const merged = {};
  const rootDir = path.resolve(__dirname, "..");
  const candidates = [".env.local", ".env"];

  candidates.forEach((fileName) => {
    const filePath = path.join(rootDir, fileName);

    try {
      const content = fs.readFileSync(filePath, "utf8");
      Object.assign(merged, parseEnvContent(content));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  });

  localEnvCache = merged;
  return merged;
}

function resolveEnvValue(keys = []) {
  for (const key of keys) {
    const processValue = normalizeAccessCode(process.env[key]);
    if (processValue) {
      return processValue;
    }
  }

  const localEnv = readLocalEnv();
  for (const key of keys) {
    const localValue = normalizeAccessCode(localEnv[key]);
    if (localValue) {
      return localValue;
    }
  }

  return "";
}

function resolveOwnerAccessCode() {
  return resolveEnvValue(OWNER_ACCESS_CODE_KEYS);
}

function resolveGuestAccessCodes() {
  const raw = resolveEnvValue(GUEST_ACCESS_CODE_KEYS);
  return new Set(
    raw
      .split(",")
      .map((value) => normalizeAccessCode(value))
      .filter(Boolean)
  );
}

function isGuestAccessCode(code) {
  return resolveGuestAccessCodes().has(code);
}

function buildAccessFailure(reason = INVALID_ACCESS_CODE) {
  return {
    ok: false,
    mode: "unknown",
    stateKey: "",
    code: "",
    seedPortfolio: null,
    reason,
  };
}

function getAccessFailureResponse(profile = null) {
  if (profile?.reason === OWNER_ACCESS_CODE_MISSING) {
    return {
      statusCode: 503,
      payload: {
        error: "접속 코드가 아직 설정되지 않았습니다. OWNER_ACCESS_CODE를 환경변수에 설정해주세요.",
      },
    };
  }

  return {
    statusCode: 401,
    payload: {
      error: "코드가 맞지 않습니다.",
    },
  };
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
  const ownerAccessCode = resolveOwnerAccessCode();

  if (ownerAccessCode && code === ownerAccessCode) {
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

  return ownerAccessCode ? buildAccessFailure(INVALID_ACCESS_CODE) : buildAccessFailure(OWNER_ACCESS_CODE_MISSING);
}

module.exports = {
  buildEmptyPortfolio,
  getAccessFailureResponse,
  normalizeAccessCode,
  resolveAccessProfile,
  resolveGuestAccessCodes,
  resolveOwnerAccessCode,
};
