const { sendJson } = require("../lib/api-route-utils");

module.exports = async (_request, response) => {
  sendJson(response, 404, { error: "Not Found" });
};
