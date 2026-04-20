const path = require("path");

const { readJsonBody, resolveMutationErrorStatus, sendError, sendJson } = require("../lib/api-route-utils");
const { getCurrentPortfolio, updateCashPositionEntry } = require("../lib/persisted-portfolio-service");
const { getAccessFailureResponse, resolveAccessProfile } = require("../lib/access-control");
const { getStorageHealth } = require("../lib/server-state-store");
const { getBundledPortfolioData } = require("../lib/bundled-portfolio");

module.exports = async (request, response) => {
  const requestUrl = new URL(request.url || "/api/portfolio", "http://localhost");
  const isStorageHealthRequest = requestUrl.searchParams.get("storageHealth") === "1";

  if (isStorageHealthRequest && request.method !== "GET") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET" });
    return;
  }

  if (!["GET", "PUT"].includes(request.method || "")) {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "GET, PUT" });
    return;
  }

  try {
    const profile = resolveAccessProfile(request.headers["x-access-code"], getBundledPortfolioData());
    if (!profile.ok) {
      const failure = getAccessFailureResponse(profile);
      sendJson(response, failure.statusCode, failure.payload);
      return;
    }

    const rootDir = path.resolve(__dirname, "..");
    if (request.method === "PUT") {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 현금 보유를 수정할 수 없습니다." });
        return;
      }

      const mutationId = String(request.headers["x-mutation-id"] || "").trim();
      const payload = await readJsonBody(request);
      const updatedPortfolio = await updateCashPositionEntry(rootDir, payload, profile.seedPortfolio, profile.stateKey, {
        mutationId,
        variant: profile.variant,
      });
      sendJson(response, 200, updatedPortfolio);
      return;
    }

    if (isStorageHealthRequest) {
      if (profile.mode !== "owner") {
        sendJson(response, 403, { error: "게스트 코드는 저장 상태를 조회할 수 없습니다." });
        return;
      }

      const health = await getStorageHealth(rootDir, profile.stateKey);
      sendJson(response, 200, health);
      return;
    }

    const portfolio = await getCurrentPortfolio(rootDir, profile.seedPortfolio, profile.stateKey, {
      variant: profile.variant,
    });
    sendJson(response, 200, portfolio);
  } catch (error) {
    sendError(response, error, "포트폴리오를 불러오지 못했습니다.", { statusResolver: resolveMutationErrorStatus });
  }
};
