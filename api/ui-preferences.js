const path = require("path");

const { readJsonBody, resolveMutationErrorStatus, sendError, sendJson } = require("../lib/api-route-utils");
const { updateUiPreferencesEntry } = require("../lib/persisted-portfolio-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");

module.exports = async (request, response) => {
  if (request.method !== "PUT") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "PUT" });
    return;
  }

  try {
    const profile = resolveAccessProfile(request.headers["x-access-code"], getBundledPortfolioData());
    const mutationId = String(request.headers["x-mutation-id"] || "").trim();
    if (!profile.ok) {
      const failure = getAccessFailureResponse(profile);
      sendJson(response, failure.statusCode, failure.payload);
      return;
    }

    if (profile.mode !== "owner") {
      sendJson(response, 403, { error: "게스트 코드는 설정 저장 기능을 사용할 수 없습니다." });
      return;
    }

    const payload = await readJsonBody(request);
    const portfolio = await updateUiPreferencesEntry(
      path.resolve(__dirname, ".."),
      payload,
      profile.seedPortfolio,
      profile.stateKey,
      {
        mutationId,
        variant: profile.variant,
      }
    );

    sendJson(response, 200, portfolio);
  } catch (error) {
    sendError(response, error, "세팅 저장에 실패했습니다.", { statusResolver: resolveMutationErrorStatus });
  }
};
