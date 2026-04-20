const path = require("path");

const { readJsonBody, resolveMutationErrorStatus, sendError, sendJson } = require("../lib/api-route-utils");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { initializePortfolioEntry } = require("../lib/persisted-portfolio-service");
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
      sendJson(response, 403, { error: "게스트 코드는 저장 기능을 사용할 수 없습니다." });
      return;
    }

    const payload = await readJsonBody(request);
    const portfolio = await initializePortfolioEntry(
      path.resolve(__dirname, ".."),
      payload,
      profile.seedPortfolio,
      profile.stateKey,
      { mutationId }
    );

    sendJson(response, 200, portfolio);
  } catch (error) {
    sendError(response, error, "초기 자산 설정에 실패했습니다.", {
      statusResolver: resolveMutationErrorStatus,
    });
  }
};
