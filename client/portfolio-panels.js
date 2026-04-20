(function initAssetPortfolioPanels(global) {
  function createPortfolioPanelsHelpers(deps = {}) {
    const {
      colors,
      escapeHtml,
      formatCurrency,
      formatPercent,
      formatSignedCurrency,
      toneClass,
      getDisplayAssetName,
      getBlankFamilyTargetContent,
      isEmptyBoardVariant,
      buildLiveTimestampCopy,
      renderTargetListItem,
      buildTableQuoteMarkup,
      buildTableFallbackMarkup,
      tableCell,
      resolveQuoteChangeDisplay,
      getHiddenHoldings,
      buildHiddenHoldingStateKey,
      buildHoldingPreferenceItem,
      resolveHoldingLiveStatus,
      formatHoldingQuantity,
      buildHoldingQuoteMarkup,
    } = deps;

    function normalizeTargetTone(value) {
      if (value === "us-stock") {
        return "global";
      }
      if (value === "kr-stock") {
        return "domestic";
      }
      if (value === "crypto" || value === "global" || value === "domestic") {
        return value;
      }
      return "neutral";
    }

    function renderTargetGroupCard(group = {}, live = null) {
      const items = Array.isArray(group.items) ? group.items.filter(Boolean) : [];
      const tone = normalizeTargetTone(group.tone);
      const blankFamilyContent = getBlankFamilyTargetContent();
      const groupSummary =
        isEmptyBoardVariant() && !items.length
          ? blankFamilyContent.groupSummaries[group.title] || group.summary || ""
          : group.summary;
      const emptyTitle =
        isEmptyBoardVariant() ? blankFamilyContent.groupEmptyTitle : group.emptyTitle || "아직 없음";
      const emptyDescription =
        isEmptyBoardVariant()
          ? blankFamilyContent.groupEmptyDescription
          : group.emptyDescription || "새 후보가 생기면 여기에 추가합니다.";

      return `
        <article class="panel targets-market-card targets-market-card--${tone}">
          <div class="targets-market-top">
            <div>
              <p class="targets-market-label">${escapeHtml(group.label || group.title || "Target Group")}</p>
              <h3 class="targets-market-title">${escapeHtml(group.title || "목표 종목")}</h3>
            </div>
          </div>
          ${groupSummary ? `<p class="targets-market-summary">${escapeHtml(groupSummary)}</p>` : ""}
          ${
            items.length
              ? `
                <ul class="targets-list">
                  ${items.map((item) => renderTargetListItem(item, tone, live?.fx || {})).join("")}
                </ul>
              `
              : `
                <div class="targets-empty">
                  <strong>${escapeHtml(emptyTitle)}</strong>
                  <p>${escapeHtml(emptyDescription)}</p>
                </div>
              `
          }
        </article>
      `;
    }

    function renderTargets(targets, live) {
      const hero = global.document.querySelector("#targets-hero");
      const grid = global.document.querySelector("#targets-grid");
      if (!hero || !grid) {
        return;
      }

      const groups = Array.isArray(targets?.groups) ? targets.groups : [];
      const totalCount = groups.reduce((total, group) => {
        const items = Array.isArray(group?.items) ? group.items.filter(Boolean) : [];
        return total + items.length;
      }, 0);
      const blankFamilyContent = getBlankFamilyTargetContent();
      const heroSummary =
        isEmptyBoardVariant() && totalCount === 0
          ? blankFamilyContent.heroSummary
          : targets?.summary || "매수 버튼보다 먼저 보는 후보군입니다.";

      hero.innerHTML = `
        <div class="targets-hero-top">
          <div>
            <p class="eyebrow">${escapeHtml(targets?.eyebrow || "Target Board")}</p>
            <p class="targets-hero-summary">${escapeHtml(heroSummary)}</p>
          </div>
        </div>
        <div class="targets-live-row">
          <span class="targets-live-badge targets-live-badge--${escapeHtml(live?.status?.level || "neutral")}">${escapeHtml(
            live?.status?.message || "실시간 연결 준비 중"
          )}</span>
          <span class="targets-live-meta">${escapeHtml(buildLiveTimestampCopy(live))}</span>
        </div>
        ${
          totalCount
            ? ""
            : `
              <div class="targets-empty">
                <strong>${escapeHtml(
                  isEmptyBoardVariant() ? blankFamilyContent.emptyBoardTitle : "아직 없음"
                )}</strong>
                <p>${escapeHtml(
                  isEmptyBoardVariant() ? blankFamilyContent.emptyBoardDescription : "후보 종목이 정리되면 이 보드부터 채워집니다."
                )}</p>
              </div>
            `
        }
      `;

      grid.innerHTML = groups.map((group) => renderTargetGroupCard(group, live)).join("");
    }

    function renderAllocation(summary, assetStatus, cashPositions) {
      const isCryptoAsset = (item) => item.category === "암호화폐" || item.platform === "업비트";

      const allocation = [
        {
          label: "암호화폐",
          value: assetStatus.filter(isCryptoAsset).reduce((total, item) => total + item.valuation, 0),
        },
        {
          label: "해외주식",
          value: assetStatus.filter((item) => item.category === "해외주식").reduce((total, item) => total + item.valuation, 0),
        },
        {
          label: "국내주식",
          value: assetStatus.filter((item) => item.category === "국내주식").reduce((total, item) => total + item.valuation, 0),
        },
        {
          label: "현금성 자산",
          value: cashPositions.reduce((total, item) => total + item.amount, 0),
        },
      ].filter((item) => item.value > 0);

      const total = summary.totalAssets || 1;
      const radius = 48;
      const circumference = 2 * Math.PI * radius;
      let offset = 0;

      const segments = allocation
        .map((item, index) => {
          const length = (item.value / total) * circumference;
          const segment = `
            <circle
              cx="60"
              cy="60"
              r="${radius}"
              fill="none"
              stroke="${colors[index % colors.length]}"
              stroke-width="14"
              stroke-linecap="round"
              stroke-dasharray="${length} ${circumference - length}"
              stroke-dashoffset="${-offset}"
            ></circle>
          `;
          offset += length;
          return segment;
        })
        .join("");

      const allocationVisual = global.document.querySelector("#allocation-visual");
      const allocationLegend = global.document.querySelector("#allocation-legend");
      if (!allocationVisual || !allocationLegend) {
        return;
      }

      allocationVisual.innerHTML = `
        <div class="donut-chart">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14"></circle>
            ${segments}
          </svg>
          <div class="donut-center">
            <span>총 자산</span>
            <strong>${formatCurrency(summary.totalAssets)}</strong>
          </div>
        </div>
      `;

      allocationLegend.innerHTML = allocation
        .map(
          (item, index) => `
            <div class="legend-item">
              <span class="legend-swatch" style="background:${colors[index % colors.length]}"></span>
              <div>
                <p class="legend-label">${item.label}</p>
                <strong>${formatPercent(item.value / total)}</strong>
              </div>
              <span class="legend-value">${formatCurrency(item.value)}</span>
            </div>
          `
        )
        .join("");
    }

    function renderAssetTable(assetStatus, holdings = []) {
      const body = global.document.querySelector("#asset-status-body");
      if (!body) {
        return;
      }

      const rows = holdings.length
        ? holdings.map((item) => {
            const principal = (item.quantity || 0) * (item.averagePrice || 0);
            const pnl = (item.valuation || 0) - principal;
            const dayChange = resolveQuoteChangeDisplay(item.liveQuote || null);

            return {
              asset: getDisplayAssetName(item),
              platform: item.platform,
              currentPrice: buildTableQuoteMarkup(item.liveQuote, item),
              dayChange,
              valuation: item.valuation || 0,
              principal,
              pnl,
              returnRate: item.returnRate || 0,
            };
          })
        : assetStatus.map((item) => ({
            asset: item.asset || item.assetName || item.category,
            platform: item.platform,
            currentPrice: buildTableFallbackMarkup(),
            dayChange: {
              text: "-",
              toneClass: "neutral",
            },
            valuation: item.valuation || 0,
            principal: item.principal || 0,
            pnl: item.pnl || 0,
            returnRate: item.returnRate || 0,
          }));

      body.innerHTML = rows
        .map(
          (item) => `
            <tr>
              ${tableCell("종목", item.asset)}
              ${tableCell("플랫폼", item.platform)}
              ${tableCell("현재가", item.currentPrice, "align-right numeric-cell", { allowHtml: true })}
              ${tableCell(
                "전일대비",
                item.dayChange.text,
                `align-right numeric-cell table-emphasis ${item.dayChange.toneClass || "neutral"}`
              )}
              ${tableCell("평가금액", formatCurrency(item.valuation), "align-right numeric-cell")}
              ${tableCell("원금", formatCurrency(item.principal), "align-right numeric-cell")}
              ${tableCell(
                "손익",
                formatSignedCurrency(item.pnl),
                `align-right numeric-cell table-emphasis ${toneClass(item.pnl)}`
              )}
              ${tableCell(
                "보유수익률",
                formatPercent(item.returnRate),
                `align-right numeric-cell table-emphasis ${toneClass(item.returnRate)}`
              )}
            </tr>
          `
        )
        .join("");
    }

    function renderHoldings(holdings) {
      const container = global.document.querySelector("#holdings-grid");
      if (!container) {
        return;
      }

      const activeHoldings = holdings.filter((item) => item.quantity > 0);
      const hiddenHoldingKeys = new Set(getHiddenHoldings().map((item) => buildHiddenHoldingStateKey(item)).filter(Boolean));
      const visibleHoldings = activeHoldings.filter((item) => {
        const key = buildHiddenHoldingStateKey(buildHoldingPreferenceItem(item));
        return !hiddenHoldingKeys.has(key);
      });
      const hiddenActiveHoldings = activeHoldings.filter((item) => {
        const key = buildHiddenHoldingStateKey(buildHoldingPreferenceItem(item));
        return hiddenHoldingKeys.has(key);
      });

      const visibleMarkup = visibleHoldings
        .map((item) => {
          const quote = item.liveQuote;
          const liveStatus = resolveHoldingLiveStatus(item, quote);
          const dayChange = resolveQuoteChangeDisplay(quote);
          return `
            <article class="holding-card">
              <div class="holding-head">
                <div>
                  <p class="mini-label">${item.platform}</p>
                  <strong class="holding-title">${escapeHtml(getDisplayAssetName(item))}</strong>
                </div>
                <div class="holding-actions">
                  <span class="status-tag ${liveStatus.warning ? "status-tag--warning" : ""}">${escapeHtml(liveStatus.label)}</span>
                  <button
                    type="button"
                    class="status-tag status-tag--action status-tag--danger"
                    data-holding-hide="true"
                    data-holding-market="${escapeHtml(item.market || "")}"
                    data-holding-symbol="${escapeHtml(item.symbol || "")}"
                    data-holding-asset="${escapeHtml(item.asset || item.name || "")}"
                    title="거래 기록은 그대로 두고 보유 카드에서만 숨깁니다."
                  >
                    보유 제외
                  </button>
                </div>
              </div>
              <div class="mini-stack">
                <div class="mini-row">
                  <span class="mini-label">수량</span>
                  <span class="mini-value">${formatHoldingQuantity(item)}</span>
                </div>
                <div class="mini-row">
                  <span class="mini-label">현재가</span>
                  ${buildHoldingQuoteMarkup(quote, item)}
                </div>
                <div class="mini-row">
                  <span class="mini-label">평균단가</span>
                  <span class="mini-value">${formatCurrency(item.averagePrice)}</span>
                </div>
                <div class="mini-row">
                  <span class="mini-label">평가금액</span>
                  <span class="mini-value">${formatCurrency(item.valuation)}</span>
                </div>
                <div class="mini-row">
                  <span class="mini-label">평가손익</span>
                  <span class="mini-value ${toneClass(item.pnl)}">${formatSignedCurrency(item.pnl)}</span>
                </div>
                <div class="mini-row">
                  <span class="mini-label">전일대비</span>
                  <span class="mini-value ${dayChange.toneClass}">${dayChange.text}</span>
                </div>
                <div class="mini-row">
                  <span class="mini-label">보유수익률</span>
                  <span class="mini-value ${toneClass(item.returnRate)}">${formatPercent(item.returnRate)}</span>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      const emptyMarkup =
        visibleHoldings.length === 0
          ? `
            <article class="holding-card holding-card--empty">
              <div class="holding-manager-copy">
                <p class="settings-kicker">Open Positions</p>
                <h3 class="settings-title">현재 보이는 보유 종목이 없습니다</h3>
                <p class="settings-summary">모두 매도했거나, 보유 제외로 숨긴 상태일 수 있습니다.</p>
              </div>
            </article>
          `
          : "";

      const hiddenManagerMarkup =
        hiddenActiveHoldings.length > 0
          ? `
            <article class="holding-card holding-card--manager">
              <div class="holding-manager-copy">
                <p class="settings-kicker">Hidden Positions</p>
                <h3 class="settings-title">보유에서 제외한 종목</h3>
                <p class="settings-summary">타임라인 기록은 그대로 두고, 보유 카드에서만 숨긴 종목입니다. 아래에서 바로 다시 표시할 수 있습니다.</p>
              </div>
              <div class="holding-restore-list">
                ${hiddenActiveHoldings
                  .map(
                    (item) => `
                    <button
                      type="button"
                      class="status-tag status-tag--action"
                      data-holding-restore-market="${escapeHtml(item.market || "")}"
                      data-holding-restore-symbol="${escapeHtml(item.symbol || "")}"
                      data-holding-restore-asset="${escapeHtml(item.asset || item.name || "")}"
                    >
                      ${escapeHtml(getDisplayAssetName(item))} 다시 보기
                    </button>
                  `
                  )
                  .join("")}
              </div>
            </article>
          `
          : "";

      container.innerHTML = `${visibleMarkup}${emptyMarkup}${hiddenManagerMarkup}`;
    }

    return Object.freeze({
      normalizeTargetTone,
      renderTargets,
      renderAllocation,
      renderAssetTable,
      renderHoldings,
    });
  }

  global.AssetPortfolioPanels = Object.freeze({
    createPortfolioPanelsHelpers,
  });
})(window);
