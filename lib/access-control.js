const path = require("path");
const { readLocalEnvFilesSync } = require("./env-file");
const {
  getBoardConfig,
  normalizeBoardVariant,
  normalizeUiPreferences,
  resolveBoardVariant,
  resolveOwnerStateKey,
} = require("./board-config");

const OWNER_ACCESS_CODE_KEYS = ["OWNER_ACCESS_CODE", "ACCESS_CODE"];
const OWNER_ACCESS_CODE_PROFILE_KEYS = ["OWNER_ACCESS_CODE_PROFILES", "ACCESS_CODE_PROFILES"];
const GUEST_ACCESS_CODE_KEYS = ["GUEST_ACCESS_CODES", "GUEST_ACCESS_CODE"];
const OWNER_ACCESS_CODE_MISSING = "owner_code_missing";
const INVALID_ACCESS_CODE = "invalid_code";
let localEnvCache = null;

function normalizeAccessCode(value = "") {
  return String(value || "").trim();
}

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

function buildProfileStateKey(code = "", index = 0) {
  const normalized = normalizeAccessCode(code)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `owner-${normalized}` : `owner-profile-${index + 1}`;
}

function normalizeOwnerAccessProfile(input = {}, index = 0) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("OWNER_ACCESS_CODE_PROFILES의 각 항목은 객체여야 합니다.");
  }

  const code = normalizeAccessCode(input.code);
  if (!code) {
    throw new Error("OWNER_ACCESS_CODE_PROFILES의 각 항목에는 code가 필요합니다.");
  }

  return {
    code,
    stateKey: normalizeAccessCode(input.stateKey) || buildProfileStateKey(code, index),
    variant: normalizeBoardVariant(input.variant || resolveBoardVariant()),
  };
}

function resolveConfiguredOwnerAccessProfiles() {
  const raw = resolveEnvValue(OWNER_ACCESS_CODE_PROFILE_KEYS);
  if (!raw) {
    return [];
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("OWNER_ACCESS_CODE_PROFILES는 JSON 배열 형식이어야 합니다.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("OWNER_ACCESS_CODE_PROFILES는 JSON 배열 형식이어야 합니다.");
  }

  const registry = new Map();
  parsed.forEach((item, index) => {
    if (item == null) {
      return;
    }

    const profile = normalizeOwnerAccessProfile(item, index);
    registry.set(profile.code, profile);
  });

  return Array.from(registry.values());
}

function resolveOwnerAccessProfiles() {
  const registry = new Map();
  resolveConfiguredOwnerAccessProfiles().forEach((profile) => {
    registry.set(profile.code, profile);
  });

  const legacyOwnerCode = resolveOwnerAccessCode();
  if (legacyOwnerCode && !registry.has(legacyOwnerCode)) {
    registry.set(legacyOwnerCode, {
      code: legacyOwnerCode,
      stateKey: resolveOwnerStateKey(),
      variant: normalizeBoardVariant(resolveBoardVariant()),
    });
  }

  return Array.from(registry.values());
}

function resolveOwnerAccessCodeLengths() {
  return [...new Set(resolveOwnerAccessProfiles().map((profile) => profile.code.length).filter((length) => length > 0))].sort((left, right) => left - right);
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
        error: "접속 코드가 아직 설정되지 않았습니다. OWNER_ACCESS_CODE 또는 OWNER_ACCESS_CODE_PROFILES를 환경변수에 설정해주세요.",
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

function buildEmptyPortfolio(template = {}, variant = resolveBoardVariant()) {
  const normalizedVariant = normalizeBoardVariant(variant);
  const next = structuredClone(template || {});

  next.metadata = {
    ...(next.metadata || {}),
    title: "",
    mantra: "",
    basisDateLabel: getTodayBasisLabel(),
    boardVariant: normalizedVariant,
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
  next.strategyBudgets = {
    items: [],
  };
  next.uiPreferences = normalizeUiPreferences(undefined, normalizedVariant);
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

function buildSeedPortfolio(ownerPortfolio = {}, variant = resolveBoardVariant()) {
  const normalizedVariant = normalizeBoardVariant(variant);
  if (normalizedVariant === "blank-family") {
    return buildEmptyPortfolio(ownerPortfolio, normalizedVariant);
  }

  const next = structuredClone(ownerPortfolio || {});
  next.metadata = {
    ...(next.metadata || {}),
    boardVariant: normalizedVariant,
  };
  next.uiPreferences = normalizeUiPreferences(next.uiPreferences, normalizedVariant);
  return next;
}

function getResolvedBoardConfig(variant = resolveBoardVariant()) {
  const normalizedVariant = normalizeBoardVariant(variant);
  return {
    ...getBoardConfig(normalizedVariant),
    variant: normalizedVariant,
  };
}

function resolveAccessProfile(inputCode = "", ownerPortfolio = {}) {
  const code = normalizeAccessCode(inputCode);
  const ownerProfiles = resolveOwnerAccessProfiles();
  const ownerProfile = ownerProfiles.find((item) => item.code === code);

  if (ownerProfile) {
    const board = getResolvedBoardConfig(ownerProfile.variant);
    return {
      ok: true,
      mode: "owner",
      stateKey: ownerProfile.stateKey,
      code,
      variant: ownerProfile.variant,
      board,
      seedPortfolio: buildSeedPortfolio(ownerPortfolio, ownerProfile.variant),
    };
  }

  if (isGuestAccessCode(code)) {
    const board = getResolvedBoardConfig();
    return {
      ok: true,
      mode: "guest",
      stateKey: `guest-${code.toLowerCase()}`,
      code,
      variant: board.variant,
      board,
      seedPortfolio: buildEmptyPortfolio(ownerPortfolio, board.variant),
    };
  }

  return ownerProfiles.length ? buildAccessFailure(INVALID_ACCESS_CODE) : buildAccessFailure(OWNER_ACCESS_CODE_MISSING);
}

module.exports = {
  buildEmptyPortfolio,
  buildSeedPortfolio,
  getAccessFailureResponse,
  getResolvedBoardConfig,
  normalizeAccessCode,
  resolveAccessProfile,
  resolveOwnerAccessCodeLengths,
  resolveOwnerAccessProfiles,
  resolveGuestAccessCodes,
  resolveOwnerAccessCode,
};
