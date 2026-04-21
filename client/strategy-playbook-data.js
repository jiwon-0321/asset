(function initAssetStrategyPlaybookData(global) {
  function createStrategyPlaybookDataHelpers(deps = {}) {
    const { normalizeTradeStrategyStage } = deps;

    function buildTrailingStopRuleCopy() {
      return "상승 시 고점 기준으로 스탑 상향, 하락 시 기존 스탑 유지.";
    }

    function stripEntryCumulativeCopy(value = "") {
      return String(value || "")
        .replace(/전체\s*보유량\s*기준\s*누적\s*/g, "전체 보유량 기준 ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function buildStrategyExitStepNote(step = {}) {
      const baseNote = String(step?.note || "").trim();
      if (normalizeTradeStrategyStage(step?.stage) !== "3단계 추적") {
        return baseNote;
      }

      return [baseNote, buildTrailingStopRuleCopy()].filter(Boolean).join(" · ");
    }

    function buildStrategyTrailingNotes(notes = []) {
      const normalizedNotes = Array.isArray(notes)
        ? notes.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
      const trailingRule = buildTrailingStopRuleCopy();

      const preservedNotes = normalizedNotes.filter((item) => !(item.includes("최고점") && item.includes("스탑")));
      return [...preservedNotes, trailingRule];
    }

    function normalizeStrategyEntryStep(step = {}) {
      return {
        ...(step && typeof step === "object" ? step : {}),
        allocation: stripEntryCumulativeCopy(step?.allocation),
        summary: stripEntryCumulativeCopy(step?.summary),
      };
    }

    function normalizeStrategyPlaybook(strategy = null) {
      if (!strategy || typeof strategy !== "object") {
        return null;
      }

      const entry = strategy.entry && typeof strategy.entry === "object" ? strategy.entry : {};
      const exit = strategy.exit && typeof strategy.exit === "object" ? strategy.exit : {};
      const normalizedEntrySteps = Array.isArray(entry.steps) ? entry.steps.map((step) => normalizeStrategyEntryStep(step)) : [];
      const normalizedSteps = Array.isArray(exit.steps)
        ? exit.steps.map((step) => ({
            ...(step && typeof step === "object" ? step : {}),
            note: buildStrategyExitStepNote(step),
          }))
        : [];

      return {
        ...strategy,
        entry: {
          ...entry,
          steps: normalizedEntrySteps,
        },
        exit: {
          ...exit,
          steps: normalizedSteps,
          trailingNotes: buildStrategyTrailingNotes(exit.trailingNotes),
        },
      };
    }

    return Object.freeze({
      buildTrailingStopRuleCopy,
      stripEntryCumulativeCopy,
      buildStrategyExitStepNote,
      buildStrategyTrailingNotes,
      normalizeStrategyEntryStep,
      normalizeStrategyPlaybook,
    });
  }

  global.AssetStrategyPlaybookData = Object.freeze({
    createStrategyPlaybookDataHelpers,
  });
})(window);
