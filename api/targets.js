const path = require("path");

const { readJsonBody, sendJson } = require("../lib/api-route-utils");
const { createTarget, deleteTargetEntry } = require("../lib/persisted-portfolio-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const bundledPortfolioData = require("../data/portfolio.json");

module.exports = async (request, response) => {
  if (!["POST", "DELETE"].includes(request.method || "")) {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "POST,DELETE" });
    return;
  }

  try {
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

    const payload = await readJsonBody(request);
    const rootDir = path.resolve(__dirname, "..");
    const portfolio =
      request.method === "POST"
        ? await createTarget(rootDir, payload, profile.seedPortfolio, profile.stateKey, { mutationId })
        : await deleteTargetEntry(rootDir, payload, profile.seedPortfolio, profile.stateKey, { mutationId });

    sendJson(response, 200, portfolio);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "관심종목 처리에 실패했습니다." });
  }
};
