const bundledPortfolioData = require("../data/portfolio.json");
const { readJsonBody, sendJson } = require("../lib/api-route-utils");
const { resolveAccessProfile } = require("../lib/access-control");

module.exports = async (request, response) => {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method Not Allowed" }, { Allow: "POST" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const profile = resolveAccessProfile(payload.code, bundledPortfolioData);

    if (!profile.ok) {
      sendJson(response, 401, { error: "코드가 맞지 않습니다." });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      mode: profile.mode,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || "접속 확인에 실패했습니다." });
  }
};
