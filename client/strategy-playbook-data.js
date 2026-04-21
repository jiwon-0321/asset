(function initAssetStrategyPlaybookData(global) {
  function createStrategyPlaybookDataHelpers(deps = {}) {
    const { normalizeTradeStrategyStage } = deps;

    function buildTrailingStopRuleCopy() {
      return "주가가 오르면 그날 최고점 기준으로 스탑을 끌어올리고, 주가가 내려오면 이전 스탑은 그대로 유지합니다.";
    }

    function buildStrategyExitStepNote(step = {}) {
      const baseNote = String(step?.note || "").trim();
      if (normalizeTradeStrategyStage(step?.stage) !== "3단계 추적") {
        return baseNote;
      }

      return [baseNote, buildTrailingStopRuleCopy()].filter(Boolean).join(" ");
    }

    function buildStrategyTrailingNotes(notes = []) {
      const normalizedNotes = Array.isArray(notes)
        ? notes.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const trailingRule = buildTrailingStopRuleCopy();

      if (normalizedNotes.some((item) => item.includes("최고점") && item.includes("스탑"))) {
        return normalizedNotes;
      }

      return [...normalizedNotes, trailingRule];
    }

    function normalizeStrategyPlaybook(strategy = null) {
      if (!strategy || typeof strategy !== "object") {
        return null;
      }

      const exit = strategy.exit && typeof strategy.exit === "object" ? strategy.exit : {};
      const normalizedSteps = Array.isArray(exit.steps)
        ? exit.steps.map((step) => ({
            ...(step && typeof step === "object" ? step : {}),
            note: buildStrategyExitStepNote(step),
          }))
        : [];

      return {
        ...strategy,
        exit: {
          ...exit,
          steps: normalizedSteps,
          trailingNotes: buildStrategyTrailingNotes(exit.trailingNotes),
        },
      };
    }

    return Object.freeze({
      buildTrailingStopRuleCopy,
      buildStrategyExitStepNote,
      buildStrategyTrailingNotes,
      normalizeStrategyPlaybook,
    });
  }

  global.AssetStrategyPlaybookData = Object.freeze({
    createStrategyPlaybookDataHelpers,
  });
})(window);
