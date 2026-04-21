(function initAssetStrategyPlaybookShell(global) {
  function createStrategyPlaybookShellHelpers(deps = {}) {
    const { escapeHtml } = deps;

    function renderStrategyBulletList(items = [], className = "strategy-bullet-list") {
      return `
        <ul class="${className}">
          ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      `;
    }

    function renderEntryStepCard(step = {}) {
      return `
        <article class="strategy-step-card">
          <div class="strategy-step-head">
            <strong>${escapeHtml(step.stage)}</strong>
            <span class="strategy-step-chip">${escapeHtml(step.allocation)}</span>
          </div>
          <p class="strategy-step-summary">${escapeHtml(step.summary)}</p>
          ${renderStrategyBulletList(step.conditions, "strategy-bullet-list strategy-bullet-list--compact")}
        </article>
      `;
    }

    function renderExitStepCard(step = {}) {
      return `
        <article class="strategy-step-card strategy-step-card--exit">
          <div class="strategy-step-head">
            <strong>${escapeHtml(step.stage)}</strong>
            <span class="strategy-step-chip">${escapeHtml(step.trigger)}</span>
          </div>
          <p class="strategy-step-summary">${escapeHtml(step.action)}</p>
          <p class="strategy-step-note">${escapeHtml(step.note)}</p>
        </article>
      `;
    }

    function renderStrategyPlaybook(container, strategy = null) {
      if (!container || !strategy) {
        return;
      }

      container.innerHTML = `
        <article class="panel strategy-hero-card">
          <div class="strategy-hero-top">
            <div>
              <p class="eyebrow">Revised Playbook</p>
              <h3 class="strategy-hero-title">${escapeHtml(strategy.title)}</h3>
            </div>
            <span class="strategy-version">${escapeHtml(strategy.version)}</span>
          </div>
          <p class="strategy-hero-summary">${escapeHtml(strategy.summary)}</p>
          <p class="strategy-hero-emphasis">${escapeHtml(strategy.mindset)}</p>
          <ul class="strategy-highlights">
            ${strategy.highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>

        <div class="strategy-layout">
          <article class="panel strategy-block strategy-block--selection">
            <div class="strategy-block-head">
              <span class="strategy-section-index">${escapeHtml(strategy.selection.section)}</span>
              <div>
                <p class="eyebrow">Watchlist Filter</p>
                <h3>${escapeHtml(strategy.selection.title)}</h3>
              </div>
            </div>
            <p class="strategy-block-copy">${escapeHtml(strategy.selection.subtitle)}</p>
            <div class="strategy-subgrid">
              <section class="strategy-mini-card">
                <p class="strategy-mini-label">${escapeHtml(strategy.selection.primaryLabel)}</p>
                ${renderStrategyBulletList(strategy.selection.criteria)}
              </section>
              <section class="strategy-mini-card strategy-mini-card--warn">
                <p class="strategy-mini-label">${escapeHtml(strategy.selection.cautionLabel)}</p>
                ${renderStrategyBulletList(strategy.selection.caution)}
              </section>
            </div>
          </article>

          <article class="panel strategy-block strategy-block--entry">
            <div class="strategy-block-head">
              <span class="strategy-section-index">${escapeHtml(strategy.entry.section)}</span>
              <div>
                <p class="eyebrow">Sizing Ladder</p>
                <h3>${escapeHtml(strategy.entry.title)}</h3>
              </div>
            </div>
            <p class="strategy-block-copy">${escapeHtml(strategy.entry.intro)}</p>
            <div class="strategy-step-grid">
              ${strategy.entry.steps.map((step) => renderEntryStepCard(step)).join("")}
            </div>
            <div class="strategy-reserve-card">
              <div>
                <p class="strategy-mini-label">${escapeHtml(strategy.entry.reserve.label)}</p>
                <strong class="strategy-reserve-title">${escapeHtml(strategy.entry.reserve.summary)}</strong>
              </div>
              ${renderStrategyBulletList(strategy.entry.reserve.details, "strategy-bullet-list strategy-bullet-list--compact")}
            </div>
            <section class="strategy-callout">
              <p class="strategy-mini-label">핵심 변경 포인트</p>
              ${renderStrategyBulletList(strategy.entry.keyPoints, "strategy-bullet-list strategy-bullet-list--compact")}
            </section>
          </article>

          <article class="panel strategy-block strategy-block--exit">
            <div class="strategy-block-head">
              <span class="strategy-section-index">${escapeHtml(strategy.exit.section)}</span>
              <div>
                <p class="eyebrow">Profit Taking</p>
                <h3>${escapeHtml(strategy.exit.title)}</h3>
              </div>
            </div>
            <p class="strategy-block-copy">${escapeHtml(strategy.exit.intro)}</p>
            <div class="strategy-step-grid strategy-step-grid--exit">
              ${strategy.exit.steps.map((step) => renderExitStepCard(step)).join("")}
            </div>
            <section class="strategy-callout strategy-callout--subtle">
              <p class="strategy-mini-label">트레일링 운용 메모</p>
              ${renderStrategyBulletList(strategy.exit.trailingNotes, "strategy-bullet-list strategy-bullet-list--compact")}
            </section>
          </article>

          <article class="panel strategy-block strategy-block--stops">
            <div class="strategy-block-head">
              <span class="strategy-section-index">${escapeHtml(strategy.stops.section)}</span>
              <div>
                <p class="eyebrow">Risk Control</p>
                <h3>${escapeHtml(strategy.stops.title)}</h3>
              </div>
            </div>
            <div class="strategy-subgrid strategy-subgrid--stops">
              <section class="strategy-mini-card">
                <p class="strategy-mini-label">${escapeHtml(strategy.stops.priceStop.label)}</p>
                <strong class="strategy-rule-title">${escapeHtml(strategy.stops.priceStop.rule)}</strong>
                ${renderStrategyBulletList(strategy.stops.priceStop.details, "strategy-bullet-list strategy-bullet-list--compact")}
              </section>
              <section class="strategy-mini-card">
                <p class="strategy-mini-label">${escapeHtml(strategy.stops.timeStop.label)}</p>
                <strong class="strategy-rule-title">${escapeHtml(strategy.stops.timeStop.rule)}</strong>
                ${renderStrategyBulletList(strategy.stops.timeStop.details, "strategy-bullet-list strategy-bullet-list--compact")}
              </section>
            </div>
          </article>
        </div>
      `;
    }

    return Object.freeze({
      renderEntryStepCard,
      renderExitStepCard,
      renderStrategyBulletList,
      renderStrategyPlaybook,
    });
  }

  global.AssetStrategyPlaybookShell = Object.freeze({
    createStrategyPlaybookShellHelpers,
  });
})(window);
