const path = require("path");

const { sendJson } = require("../lib/api-route-utils");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { getStorageHealth } = require("../lib/server-state-store");
const bundledPortfolioData = require("../data/portfolio.json");

module.exports = async (request, response) => {
  if ((request.method || "") !== "GET") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET" });
    return;
  }

  try {
    const profile = resolveAccessProfile(request.headers["x-access-code"], bundledPortfolioData);
    if (!profile.ok) {
      const failure = getAccessFailureResponse(profile);
      sendJson(response, failure.statusCode, failure.payload);
      return;
    }
    if (profile.mode !== "owner") {
      sendJson(response, 403, { error: "게스트 코드는 저장 상태를 조회할 수 없습니다." });
      return;
    }

    const rootDir = path.resolve(__dirname, "..");
    const health = await getStorageHealth(rootDir, profile.stateKey);
    sendJson(response, 200, health);
  } catch (error) {
    sendJson(response, 500, { error: error.message || "저장 상태를 불러오지 못했습니다." });
  }
};
