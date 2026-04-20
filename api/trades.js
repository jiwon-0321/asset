const path = require("path");

const { readJsonBody, resolveMutationErrorStatus, sendError, sendJson } = require("../lib/api-route-utils");
const { createTrade, deleteTradeEntry, updateTradeEntry } = require("../lib/persisted-portfolio-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { createTradePhotoAssistDraft } = require("../lib/trade-photo-assist");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");

const PHOTO_ASSIST_REQUEST_LIMIT_BYTES = 3840 * 1024;

module.exports = async (request, response) => {
  const requestUrl = new URL(request.url || "/api/trades", "http://localhost");
  const isPhotoAssistRequest = requestUrl.searchParams.get("photoAssist") === "1";

  if (isPhotoAssistRequest && request.method !== "POST") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "POST" });
    return;
  }

  if (!isPhotoAssistRequest && !["POST", "PUT", "DELETE"].includes(request.method || "")) {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "POST,PUT,DELETE" });
    return;
  }

  try {
    const bundledPortfolioData = getBundledPortfolioData();
    const profile = resolveAccessProfile(request.headers["x-access-code"], bundledPortfolioData);
    const mutationId = String(request.headers["x-mutation-id"] || "").trim();
    if (!profile.ok) {
      const failure = getAccessFailureResponse(profile);
      sendJson(response, failure.statusCode, failure.payload);
      return;
    }
    if (profile.mode !== "owner") {
      sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." });
      return;
    }

    const payload = await readJsonBody(
      request,
      isPhotoAssistRequest
        ? {
            maxBytes: PHOTO_ASSIST_REQUEST_LIMIT_BYTES,
            payloadTooLargeMessage: "사진 요청 크기가 너무 큽니다. 캡처 범위를 조금 줄여서 다시 시도해주세요.",
            invalidJsonMessage: "사진 요청 형식이 올바르지 않습니다.",
          }
        : {}
    );
    if (isPhotoAssistRequest) {
      const result = await createTradePhotoAssistDraft({
        payload,
        basisLabel: profile.seedPortfolio?.metadata?.basisDateLabel || bundledPortfolioData?.metadata?.basisDateLabel || "",
      });
      sendJson(response, 200, result);
      return;
    }

    const rootDir = path.resolve(__dirname, "..");

    const portfolio =
      request.method === "POST"
        ? await createTrade(rootDir, payload, profile.seedPortfolio, profile.stateKey, {
            mutationId,
            variant: profile.variant,
          })
        : request.method === "PUT"
          ? await updateTradeEntry(rootDir, payload, profile.seedPortfolio, profile.stateKey, {
              mutationId,
              variant: profile.variant,
            })
          : await deleteTradeEntry(rootDir, payload, profile.seedPortfolio, profile.stateKey, {
              mutationId,
              variant: profile.variant,
            });

    sendJson(response, 200, portfolio);
  } catch (error) {
    sendError(response, error, "거래 처리에 실패했습니다.", { statusResolver: resolveMutationErrorStatus });
  }
};
