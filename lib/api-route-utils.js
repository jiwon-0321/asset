function normalizeStatusCode(statusCode, fallbackStatusCode = 500) {
  const normalized = Number(statusCode);
  if (Number.isInteger(normalized) && normalized >= 100 && normalized < 600) {
    return normalized;
  }

  const fallback = Number(fallbackStatusCode);
  if (Number.isInteger(fallback) && fallback >= 100 && fallback < 600) {
    return fallback;
  }

  return null;
}

function createHttpError(message = "요청을 처리하지 못했습니다.", statusCode = 500, options = {}) {
  const error = new Error(String(message || "요청을 처리하지 못했습니다."));
  error.statusCode = normalizeStatusCode(statusCode, 500);

  if (options.code) {
    error.code = options.code;
  }

  if (options.cause) {
    error.cause = options.cause;
  }

  return error;
}

function getErrorStatusCode(error, fallbackStatusCode = 500) {
  return normalizeStatusCode(error?.statusCode ?? error?.status, fallbackStatusCode);
}

function getErrorMessage(error, fallbackMessage = "요청을 처리하지 못했습니다.") {
  const message = String(error?.message || "").trim();
  return message || fallbackMessage;
}

function isPayloadTooLargeError(error) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    getErrorStatusCode(error, null) === 413 ||
    error?.code === "PAYLOAD_TOO_LARGE" ||
    message.includes("payload too large") ||
    message.includes("request body too large") ||
    message.includes("entity too large")
  );
}

function resolveMutationErrorStatus(error, fallbackStatusCode = 500) {
  const explicitStatusCode = getErrorStatusCode(error, null);
  if (explicitStatusCode != null) {
    return explicitStatusCode;
  }

  const message = getErrorMessage(error, "");
  if (!message) {
    return fallbackStatusCode;
  }

  if (message.includes("찾지 못했습니다")) {
    return 404;
  }

  if (
    message.includes("다른 변경이 먼저 저장되었습니다") ||
    message.includes("이미 관심종목에 있는") ||
    message.includes("이미 데이터가 있어") ||
    message.includes("부족합니다")
  ) {
    return 409;
  }

  if (
    message.includes("확인하세요") ||
    message.includes("입력하세요") ||
    message.includes("선택하세요") ||
    message.includes("지원합니다") ||
    message.includes("형식으로 입력하세요") ||
    message.includes("유효한 날짜") ||
    message.includes("0보다") ||
    message.includes("0원 이상") ||
    message.includes("빈 보드 배포에서만") ||
    message.includes("이전의 과거 거래는 추가할 수 없습니다")
  ) {
    return 400;
  }

  return fallbackStatusCode;
}

function sendError(response, error, fallbackMessage = "요청을 처리하지 못했습니다.", options = {}) {
  const defaultStatusCode = normalizeStatusCode(options.defaultStatusCode, 500) || 500;
  const statusResolver = typeof options.statusResolver === "function" ? options.statusResolver : getErrorStatusCode;
  const statusCode = statusResolver(error, defaultStatusCode) || defaultStatusCode;
  sendJson(response, statusCode, { error: getErrorMessage(error, fallbackMessage) }, options.headers || {});
}

async function readJsonBody(request, options = {}) {
  const chunks = [];
  const maxBytes = Number.isFinite(Number(options.maxBytes)) && Number(options.maxBytes) > 0 ? Number(options.maxBytes) : null;
  let totalBytes = 0;

  try {
    for await (const chunk of request) {
      const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
      totalBytes += buffer.length;

      if (maxBytes != null && totalBytes > maxBytes) {
        throw createHttpError(options.payloadTooLargeMessage || "요청 본문이 너무 큽니다.", 413, {
          code: "PAYLOAD_TOO_LARGE",
        });
      }

      chunks.push(buffer);
    }
  } catch (error) {
    if (isPayloadTooLargeError(error)) {
      throw createHttpError(options.payloadTooLargeMessage || "요청 본문이 너무 큽니다.", 413, {
        code: "PAYLOAD_TOO_LARGE",
        cause: error,
      });
    }

    throw error;
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw createHttpError(options.invalidJsonMessage || "JSON 요청 본문 형식이 올바르지 않습니다.", 400, {
      code: "INVALID_JSON",
      cause: error,
    });
  }
}

function sendJson(response, statusCode, payload, headers = {}) {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });

  response.end(JSON.stringify(payload));
}

module.exports = {
  createHttpError,
  getErrorMessage,
  getErrorStatusCode,
  readJsonBody,
  resolveMutationErrorStatus,
  sendError,
  sendJson,
};
