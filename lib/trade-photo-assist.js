const path = require("path");
const { readLocalEnvFilesSync } = require("./env-file");

const { BROKER_OPTIONS_BY_MARKET, normalizeBrokerName } = require("./trade-fee-policy");

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_TOTAL_IMAGE_BYTES = 2560 * 1024;
const DEFAULT_MAX_IMAGE_COUNT = 4;
const ENV_PATHS = [".env.local", ".env"];
const KNOWN_CRYPTO_ASSET_NAMES = Object.freeze({
  BTC: "비트코인",
  ETH: "ETH",
  XRP: "XRP",
});

let localEnvCache = null;

function createTradePhotoAssistError(message = "사진 초안을 만들지 못했습니다.", statusCode = 422) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readLocalEnv() {
  if (localEnvCache) {
    return localEnvCache;
  }

  const rootDir = path.resolve(__dirname, "..");
  const merged = readLocalEnvFilesSync(rootDir, ENV_PATHS);
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

function resolvePositiveIntegerEnv(keys = [], fallbackValue) {
  const rawValue = resolveEnvValue(keys);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallbackValue;
}

function resolveTradePhotoAssistConfig() {
  return {
    apiKey: resolveEnvValue(["GEMINI_API_KEY"]),
    model: resolveEnvValue(["TRADE_PHOTO_ASSIST_GEMINI_MODEL"]) || DEFAULT_GEMINI_MODEL,
    timeoutMs: resolvePositiveIntegerEnv(["TRADE_PHOTO_ASSIST_TIMEOUT_MS"], DEFAULT_TIMEOUT_MS),
    maxImageBytes: resolvePositiveIntegerEnv(["TRADE_PHOTO_ASSIST_MAX_IMAGE_BYTES"], DEFAULT_MAX_IMAGE_BYTES),
    maxTotalImageBytes: resolvePositiveIntegerEnv(
      ["TRADE_PHOTO_ASSIST_MAX_TOTAL_IMAGE_BYTES"],
      DEFAULT_MAX_TOTAL_IMAGE_BYTES
    ),
    maxImageCount: resolvePositiveIntegerEnv(["TRADE_PHOTO_ASSIST_MAX_IMAGE_COUNT"], DEFAULT_MAX_IMAGE_COUNT),
  };
}

function formatImageByteLimit(bytes = 0) {
  const megaBytes = Number(bytes || 0) / (1024 * 1024);
  return `${megaBytes.toFixed(1)}MB`;
}

function parseDataUrlImage(rawValue = "") {
  const trimmed = String(rawValue || "").trim();
  const match = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) {
    return null;
  }

  return {
    mimeType: normalizeImageMimeType(match[1]),
    base64: normalizeBase64(match[2]),
  };
}

function normalizeBase64(value = "") {
  return String(value || "").replace(/\s+/g, "");
}

function normalizeImageMimeType(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  return normalized;
}

function normalizeRawImageEntries(payload = {}) {
  const inlineEntries = Array.isArray(payload.images) ? payload.images : [];
  if (inlineEntries.length) {
    return inlineEntries.map((entry) => {
      if (typeof entry === "string") {
        return { imageDataUrl: entry };
      }
      return entry && typeof entry === "object" ? entry : {};
    });
  }

  return [payload];
}

function parseSingleInlineImagePayload(payload = {}, index = 0) {
  const dataUrlImage =
    parseDataUrlImage(payload.imageDataUrl) ||
    parseDataUrlImage(payload.image) ||
    parseDataUrlImage(payload.imageBase64);

  const rawMimeType = normalizeImageMimeType(payload.imageMimeType || dataUrlImage?.mimeType || "");
  const base64 = normalizeBase64(dataUrlImage?.base64 || payload.imageBase64 || "");

  if (!base64) {
    throw createTradePhotoAssistError("이미지 데이터가 비어 있습니다.", 400);
  }

  if (!rawMimeType.startsWith("image/")) {
    throw createTradePhotoAssistError("이미지 파일만 업로드할 수 있습니다.", 400);
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch (error) {
    throw createTradePhotoAssistError("이미지 인코딩을 읽지 못했습니다.", 400);
  }

  if (!buffer.length) {
    throw createTradePhotoAssistError("이미지 데이터가 비어 있습니다.", 400);
  }

  return {
    buffer,
    base64: buffer.toString("base64"),
    mimeType: rawMimeType,
    fileName: String(payload.imageName || `trade-photo-${index + 1}`).trim() || `trade-photo-${index + 1}`,
  };
}

function parseInlineImagePayloads(payload = {}) {
  const imageEntries = normalizeRawImageEntries(payload);
  const imagePayloads = imageEntries
    .map((entry, index) => parseSingleInlineImagePayload(entry, index))
    .filter(Boolean);

  if (!imagePayloads.length) {
    throw createTradePhotoAssistError("이미지 데이터가 비어 있습니다.", 400);
  }

  return imagePayloads;
}

function normalizeMarketLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (["암호화폐", "crypto", "coin", "coins"].includes(normalized)) {
    return "암호화폐";
  }
  if (["미국주식", "us", "us-stock", "us stock", "미장", "해외주식", "미국 주식"].includes(normalized)) {
    return "미국주식";
  }
  if (["국내주식", "kr", "kr-stock", "kr stock", "korea", "kor", "한국주식", "국장", "국내 주식"].includes(normalized)) {
    return "국내주식";
  }

  return "";
}

function normalizeSideLabel(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (["매수", "buy", "bought", "bid"].includes(normalized)) {
    return "매수";
  }
  if (["매도", "sell", "sold", "ask"].includes(normalized)) {
    return "매도";
  }
  return "";
}

function normalizeBrokerForMarket(value = "", market = "") {
  const normalized = normalizeBrokerName(value);
  if (!normalized) {
    return market === "암호화폐" ? "업비트" : "";
  }

  if (!market) {
    return normalized;
  }

  const allowed = BROKER_OPTIONS_BY_MARKET[market] || [];
  return allowed.includes(normalized) ? normalized : market === "암호화폐" ? "업비트" : "";
}

function parseNumberLike(value, { allowZero = false } = {}) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    if (!allowZero && value <= 0) {
      return null;
    }
    if (allowZero && value < 0) {
      return null;
    }
    return value;
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/[₩$€£¥,]/g, "")
    .replace(/krw|usd|원|주|shares?|qty|수량|체결가|단가|금액/gi, "")
    .replace(/\s+/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  if (!allowZero && parsed <= 0) {
    return null;
  }
  if (allowZero && parsed < 0) {
    return null;
  }
  return parsed;
}

function parseMonthDayFromBasisLabel(basisLabel = "") {
  const match = String(basisLabel || "").match(/(\d{4})\.(\d{2})\.(\d{2})/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function formatMonthDay(month, day) {
  return `${Number(month)}/${String(Number(day)).padStart(2, "0")}`;
}

function normalizeDateValue(value = "", basisLabel = "") {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const monthDayMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (monthDayMatch) {
    return formatMonthDay(monthDayMatch[1], monthDayMatch[2]);
  }

  const yearMatch = raw.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (yearMatch) {
    return formatMonthDay(yearMatch[2], yearMatch[3]);
  }

  const shortYearMatch = raw.match(/^(\d{2})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (shortYearMatch) {
    return formatMonthDay(shortYearMatch[2], shortYearMatch[3]);
  }

  const koreanMatch = raw.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (koreanMatch) {
    return formatMonthDay(koreanMatch[1], koreanMatch[2]);
  }

  const compactMatch = raw.match(/^(\d{2})(\d{2})$/);
  if (compactMatch) {
    const basis = parseMonthDayFromBasisLabel(basisLabel);
    if (basis && Number(compactMatch[1]) === basis.month) {
      return formatMonthDay(compactMatch[1], compactMatch[2]);
    }
  }

  return "";
}

function normalizeTickerForMarket(value = "", market = "") {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) {
    return "";
  }

  if (market === "암호화폐") {
    const ticker = raw.replace(/^KRW-/, "");
    return /^[A-Z0-9]{2,15}$/.test(ticker) ? `KRW-${ticker}` : "";
  }

  if (market === "미국주식") {
    return /^[A-Z.\-]{1,15}$/.test(raw) ? raw : "";
  }

  if (market === "국내주식") {
    return /^[0-9]{6}$/.test(raw) ? raw : "";
  }

  return "";
}

function normalizeAssetField(rawAsset = "", rawSymbol = "", market = "") {
  let asset = String(rawAsset || "").trim();
  let symbol = String(rawSymbol || "").trim();

  const matched = asset.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (matched) {
    asset = matched[1].trim();
    symbol = symbol || matched[2].trim();
  }

  const normalizedSymbol = normalizeTickerForMarket(symbol || asset, market);

  if (market === "암호화폐") {
    const fallbackTicker = normalizedSymbol.replace(/^KRW-/, "");
    const upperAsset = String(asset || "").trim().toUpperCase();
    const normalizedAsset =
      KNOWN_CRYPTO_ASSET_NAMES[upperAsset] ||
      asset ||
      KNOWN_CRYPTO_ASSET_NAMES[fallbackTicker] ||
      fallbackTicker;
    return {
      asset: normalizedAsset,
      symbol: normalizedSymbol,
    };
  }

  if (!asset && normalizedSymbol) {
    return {
      asset: normalizedSymbol,
      symbol: normalizedSymbol,
    };
  }

  return {
    asset,
    symbol: normalizedSymbol,
  };
}

function clampConfidence(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return Math.max(0, Math.min(1, numeric));
}

function normalizeConfidenceMap(confidence = {}, draft = {}) {
  const inputFields = confidence && typeof confidence === "object" ? confidence.fields || {} : {};
  const normalizedFields = Object.entries(inputFields).reduce((result, [field, value]) => {
    const normalizedValue = clampConfidence(value);
    if (normalizedValue != null) {
      result[field] = normalizedValue;
    }
    return result;
  }, {});

  const fieldValues = Object.values(normalizedFields);
  const derivedOverall =
    clampConfidence(confidence?.overall) ??
    (fieldValues.length ? fieldValues.reduce((sum, value) => sum + value, 0) / fieldValues.length : null);

  const fallbackFieldKeys = ["date", "market", "broker", "asset", "side", "quantity", "price", "amount", "fee"];
  fallbackFieldKeys.forEach((field) => {
    if (normalizedFields[field] == null && draft[field] != null && draft[field] !== "") {
      normalizedFields[field] = derivedOverall ?? 0.72;
    }
  });

  return {
    overall: derivedOverall ?? 0.72,
    fields: normalizedFields,
  };
}

function normalizeStringList(values) {
  return Array.isArray(values)
    ? values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];
}

function buildComputedMissingFields(draft = {}) {
  const requiredFields = ["date", "market", "asset", "side", "quantity", "price"];
  const missing = requiredFields.filter((field) => draft[field] == null || draft[field] === "");
  if (draft.market !== "암호화폐" && !draft.broker) {
    missing.push("broker");
  }
  return missing;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function formatCandidateNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "";
  }
  if (Number.isInteger(numeric)) {
    return String(numeric);
  }
  return String(Number(numeric.toFixed(8)));
}

function buildTradePhotoAssistCandidateLabel(rawLabel = "", draft = {}) {
  const explicit = String(rawLabel || "").trim();
  if (explicit) {
    return explicit;
  }

  const assetLabel = String(draft.asset || draft.symbol || "후보").trim();
  const dateLabel = String(draft.date || "").trim();
  const sideLabel = String(draft.side || "").trim();
  const quantityLabel = formatCandidateNumber(draft.quantity);
  const quantityUnit = draft.market === "암호화폐" ? "" : "주";
  const quantityText = quantityLabel ? `${quantityLabel}${quantityUnit}` : "";

  return [dateLabel, assetLabel, sideLabel, quantityText].filter(Boolean).join(" · ") || "후보 거래";
}

function buildTradePhotoAssistCandidateSummary(rawSummary = "", rawSnippets = [], draft = {}) {
  const explicit = String(rawSummary || "").trim();
  if (explicit) {
    return explicit;
  }

  const snippets = normalizeStringList(rawSnippets);
  if (snippets.length) {
    return snippets.slice(0, 2).join(" / ");
  }

  const broker = String(draft.broker || "").trim();
  const market = String(draft.market || "").trim();
  const price = formatCandidateNumber(draft.price);
  const amount = formatCandidateNumber(draft.amount);
  return [broker || market, price ? `단가 ${price}` : "", amount ? `금액 ${amount}` : ""].filter(Boolean).join(" · ");
}

function parseGeminiJsonParts(payload = {}) {
  const text = (payload?.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .map((part) => String(part?.text || "").trim())
    .filter(Boolean)
    .join("\n");

  if (!text) {
    throw createTradePhotoAssistError("사진 초안 응답이 비어 있습니다.", 502);
  }

  const normalizedText = text.replace(/^```json\s*|```$/gim, "").trim();
  try {
    return JSON.parse(normalizedText);
  } catch (error) {
    const objectMatch = normalizedText.match(/\{[\s\S]+\}$/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw createTradePhotoAssistError("사진 초안 응답을 해석하지 못했습니다.", 502);
  }
}

function buildVisionPrompt({ marketHint = "", brokerHint = "", locale = "ko-KR", imageCount = 1 } = {}) {
  const marketHintLine = marketHint ? `- marketHint: ${marketHint}` : "- marketHint: unknown";
  const brokerHintLine = brokerHint ? `- brokerHint: ${brokerHint}` : "- brokerHint: unknown";
  return [
    "You extract up to three editable trade draft candidates from one or more broker screenshots.",
    "Return strict JSON only. Do not include markdown fences.",
    "Use Korean labels for market and side.",
    "The screenshots can show different columns of the same trade table.",
    "Schema:",
    "{",
    '  "selectedIndex": 0,',
    '  "candidates": [',
    "    {",
    '      "label": "short Korean summary",',
    '      "summary": "why this candidate fits",',
    '      "draft": {',
    '        "date": "M/DD or null",',
    '        "market": "\\"국내주식\\"|\\"미국주식\\"|\\"암호화폐\\"|null",',
    '        "broker": "\\"카카오증권\\"|\\"미래에셋\\"|\\"업비트\\"|null",',
    '        "asset": "string|null",',
    '        "symbol": "string|null",',
    '        "side": "\\"매수\\"|\\"매도\\"|null",',
    '        "quantity": "number|null",',
    '        "price": "number|null",',
    '        "amount": "number|null",',
    '        "fee": "number|null",',
    '        "note": "string|null"',
    "      },",
    '      "confidence": { "overall": 0.0, "fields": { "date": 0.0, "asset": 0.0 } },',
    '      "missingFields": ["fieldName"],',
    '      "warnings": ["Korean warning"],',
    '      "rawSnippets": ["short text copied from image"]',
    "    }",
    "  ],",
    '  "warnings": ["Korean warning"]',
    "}",
    "Rules:",
    "- Prefer the screenshot evidence over hints, but use the hints when a field is ambiguous.",
    "- Combine all screenshots before answering.",
    "- If the table is split across screenshots, match the same row using timestamp, asset, and row order.",
    "- If multiple buy/sell rows are visible, rank the latest visible matching trade row first, then include nearby plausible alternatives.",
    "- Ignore KRW deposit/withdraw rows unless there are no trade rows.",
    "- Return at most 3 candidates.",
    "- selectedIndex must point to the best candidate in the candidates array.",
    '- Convert screenshot dates like "26.04.17" or "2026.04.17" into "4/17".',
    '- If the screenshot is a U.S. trade and only USD values are visible without clear KRW totals, set price/amount to null and add a Korean warning saying KRW conversion still needs manual review.',
    '- quantity, price, amount, fee must be plain numbers without commas or currency symbols.',
    '- fee is optional and may be null.',
    "- missingFields should include any unresolved core fields.",
    `- locale: ${locale}`,
    `- imageCount: ${Number(imageCount) || 1}`,
    marketHintLine,
    brokerHintLine,
  ].join("\n");
}

async function extractTradeDraftWithVision(imagePayloads = [], options = {}) {
  const { apiKey, model, timeoutMs } = resolveTradePhotoAssistConfig();
  if (!apiKey) {
    throw createTradePhotoAssistError("GEMINI_API_KEY가 설정되지 않아 사진 초안을 만들 수 없습니다.", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: buildVisionPrompt(options),
                },
                ...imagePayloads.map((imagePayload) => ({
                  inlineData: {
                    mimeType: imagePayload.mimeType,
                    data: imagePayload.base64,
                  },
                })),
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    );

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error?.message || payload?.promptFeedback?.blockReason || "Gemini 응답을 받지 못했습니다.";
      throw createTradePhotoAssistError(`사진 초안 요청에 실패했습니다. ${message}`, response.status || 502);
    }

    return {
      payload: parseGeminiJsonParts(payload),
      model,
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createTradePhotoAssistError("사진 해석 시간이 초과되었습니다. 다시 시도해주세요.", 504);
    }
    if (error?.statusCode) {
      throw error;
    }
    throw createTradePhotoAssistError(error.message || "사진 초안을 만들지 못했습니다.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeTradePhotoDraft(rawPayload = {}, options = {}) {
  const marketHint = normalizeMarketLabel(options.marketHint);
  const brokerHint = normalizeBrokerForMarket(options.brokerHint, marketHint);
  const rawDraft = rawPayload?.draft && typeof rawPayload.draft === "object" ? rawPayload.draft : {};

  const market = normalizeMarketLabel(rawDraft.market) || marketHint;
  const side = normalizeSideLabel(rawDraft.side);
  const broker = normalizeBrokerForMarket(rawDraft.broker || brokerHint, market);
  const date = normalizeDateValue(rawDraft.date, options.basisLabel);
  const quantity = parseNumberLike(rawDraft.quantity);
  const price = parseNumberLike(rawDraft.price);
  const amount = parseNumberLike(rawDraft.amount) ?? (quantity && price ? Number((quantity * price).toFixed(8)) : null);
  const fee = parseNumberLike(rawDraft.fee, { allowZero: true });
  const { asset, symbol } = normalizeAssetField(rawDraft.asset, rawDraft.symbol, market);
  const note = String(rawDraft.note || "").trim() || "photo assist draft";
  const draft = {
    date,
    market,
    broker,
    asset,
    symbol,
    side,
    quantity,
    price,
    amount,
    fee,
    note,
  };

  const computedMissingFields = buildComputedMissingFields(draft);
  const missingFields = unique([...normalizeStringList(rawPayload?.missingFields), ...computedMissingFields]);
  const warnings = unique(normalizeStringList(rawPayload?.warnings));

  if (market === "미국주식" && (!price || !amount)) {
    warnings.push("미국주식 캡처에서 원화 체결값이 불분명하면 단가와 거래금액을 다시 확인해주세요.");
  }

  return {
    draft,
    confidence: normalizeConfidenceMap(rawPayload?.confidence || {}, draft),
    missingFields,
    warnings: unique(warnings),
  };
}

function normalizeTradePhotoAssistCandidate(rawPayload = {}, options = {}) {
  const normalizedDraft = normalizeTradePhotoDraft(rawPayload, options);
  const rawSnippets = normalizeStringList(rawPayload?.rawSnippets);

  return {
    label: buildTradePhotoAssistCandidateLabel(rawPayload?.label, normalizedDraft.draft),
    summary: buildTradePhotoAssistCandidateSummary(rawPayload?.summary, rawSnippets, normalizedDraft.draft),
    rawSnippets,
    ...normalizedDraft,
  };
}

function normalizeTradePhotoAssistResult(rawPayload = {}, options = {}) {
  const rootWarnings = normalizeStringList(rawPayload?.warnings);
  const rawCandidates = Array.isArray(rawPayload?.candidates)
    ? rawPayload.candidates.filter((candidate) => candidate && typeof candidate === "object")
    : [];

  const normalizedCandidates = (rawCandidates.length
    ? rawCandidates
    : [
        {
          draft: rawPayload?.draft,
          confidence: rawPayload?.confidence,
          missingFields: rawPayload?.missingFields,
          warnings: unique([...normalizeStringList(rawPayload?.warnings), ...normalizeStringList(rawPayload?.candidateWarnings)]),
          rawSnippets: rawPayload?.rawSnippets,
        },
      ]
  )
    .slice(0, 3)
    .map((candidate) =>
      normalizeTradePhotoAssistCandidate(
        {
          ...candidate,
          warnings: unique([...normalizeStringList(candidate?.warnings), ...rootWarnings]),
        },
        options
      )
    )
    .filter((candidate) => candidate?.draft && Object.values(candidate.draft).some((value) => value != null && value !== ""));

  if (!normalizedCandidates.length) {
    throw createTradePhotoAssistError("사진 초안 후보를 만들지 못했습니다.", 502);
  }

  const requestedIndex = Number(rawPayload?.selectedIndex);
  const selectedCandidateIndex =
    Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < normalizedCandidates.length ? requestedIndex : 0;
  const selectedCandidate = normalizedCandidates[selectedCandidateIndex] || normalizedCandidates[0];

  return {
    ...selectedCandidate,
    candidates: normalizedCandidates,
    selectedCandidateIndex,
  };
}

async function createTradePhotoAssistDraft({ payload = {}, basisLabel = "" } = {}) {
  const config = resolveTradePhotoAssistConfig();
  const imagePayloads = parseInlineImagePayloads(payload);

  if (imagePayloads.length > config.maxImageCount) {
    throw createTradePhotoAssistError(`사진은 최대 ${config.maxImageCount}장까지 함께 읽을 수 있습니다.`, 413);
  }

  imagePayloads.forEach((imagePayload, index) => {
    if (imagePayload.buffer.length > config.maxImageBytes) {
      throw createTradePhotoAssistError(
        `이미지 ${index + 1} 크기가 너무 큽니다. ${formatImageByteLimit(config.maxImageBytes)} 이하 이미지만 지원합니다.`,
        413
      );
    }
  });
  const totalImageBytes = imagePayloads.reduce((sum, imagePayload) => sum + imagePayload.buffer.length, 0);
  if (totalImageBytes > config.maxTotalImageBytes) {
    throw createTradePhotoAssistError(
      `사진 전체 크기가 너무 큽니다. 합계 ${formatImageByteLimit(config.maxTotalImageBytes)} 이하 이미지만 지원합니다.`,
      413
    );
  }

  const marketHint = normalizeMarketLabel(payload.marketHint);
  const brokerHint = normalizeBrokerForMarket(payload.brokerHint, marketHint);
  const locale = String(payload.locale || "ko-KR").trim() || "ko-KR";
  const { payload: visionPayload, model } = await extractTradeDraftWithVision(imagePayloads, {
    marketHint,
    brokerHint,
    locale,
    imageCount: imagePayloads.length,
  });
  const normalized = normalizeTradePhotoAssistResult(visionPayload, {
    basisLabel,
    marketHint,
    brokerHint,
  });

  return {
    ...normalized,
    source: {
      mode: "vision-primary",
      ocrFallbackUsed: false,
      model,
      imageCount: imagePayloads.length,
    },
  };
}

module.exports = {
  createTradePhotoAssistDraft,
  createTradePhotoAssistError,
  normalizeTradePhotoAssistCandidate,
  normalizeTradePhotoAssistResult,
  normalizeTradePhotoDraft,
};
