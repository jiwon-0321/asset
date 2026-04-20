(function initAssetRealizedDefense(global) {
  function createRealizedDefenseHelpers(deps = {}) {
    const {
      bindPanelAccordion,
      bindSectionBarMenu,
      toneClass,
      escapeHtml,
      formatSignedCurrency,
      formatCurrency,
      formatPercent,
      formatSignedPercent,
      formatNumber,
      parsePerformanceStartDateValue,
      parseMonthDayToDate,
      isXrpTradeLike,
      buildXrpRecentBuyPoolAnalytics,
      getDisplayTradeNote,
      roundXrpDefenseValue,
    } = deps;

    let defenseProfitDetailExpanded = false;

    function renderRealized(realized, totalProfit) {
      const container = global.document.querySelector("#realized-list");
      if (!container) {
        return;
      }

      const items = Array.isArray(realized) ? realized : [];

      container.innerHTML = `
        <div class="realized-item">
          <div class="realized-top">
            <div>
              <p class="mini-label">누적 실현손익</p>
              <strong>전체 실현 손익</strong>
            </div>
            <span class="realized-value ${toneClass(totalProfit)}">${formatSignedCurrency(totalProfit)}</span>
          </div>
        </div>
        ${items
          .map((item) => {
            const platform = escapeHtml(item.platform);
            const date = escapeHtml(item.date || "");
            const asset = escapeHtml(item.asset);
            const note = item.note ? ` · ${escapeHtml(item.note)}` : "";
            return `
              <div class="realized-item">
                <div class="realized-top">
                  <div>
                    <p class="mini-label">${platform} · ${date}</p>
                    <strong>${asset}</strong>
                  </div>
                  <span class="realized-value ${toneClass(item.pnl)}">${formatSignedCurrency(item.pnl)}</span>
                </div>
                <p class="metric-detail">${formatPercent(item.returnRate)} 수익률${note}</p>
              </div>
            `;
          })
          .join("")}
      `;

      bindPanelAccordion(global.document.querySelector("#realized-section"));
    }

    function renderDefense(context = {}) {
      const container = global.document.querySelector("#defense-grid");
      const note = global.document.querySelector("#defense-note");
      const detail = global.document.querySelector("#defense-detail");
      if (!container) {
        return;
      }

      const snapshot = buildXrpDefenseSnapshot(context);
      bindDefenseSection();
      if (note) {
        note.textContent = snapshot.note;
      }

      container.innerHTML = snapshot.items
        .map((item) => {
          const formatted =
            item.placeholder
              ? item.placeholder
              : item.type === "percent"
                ? item.signed
                  ? formatSignedPercent(item.value)
                  : formatPercent(item.value)
              : item.type === "quantity"
                ? `${formatNumber(item.value)} XRP`
                : item.signed
                  ? formatSignedCurrency(item.value, item.tone === "neutral")
                  : formatCurrency(item.value);
          const tagName = item.expandable ? "button" : "div";
          const interactiveAttrs = item.expandable
            ? ` type="button" class="defense-card defense-card--interactive" data-defense-profit-toggle aria-expanded="${defenseProfitDetailExpanded}" aria-controls="defense-detail"`
            : ` class="defense-card"`;
          return `
            <${tagName}${interactiveAttrs}>
              <p class="mini-label">${escapeHtml(item.label)}</p>
              <strong class="defense-value ${item.tone}">${formatted}</strong>
              ${item.hint ? `<span class="defense-card-hint">${escapeHtml(item.hint)}</span>` : ""}
            </${tagName}>
          `;
        })
        .join("");

      if (detail) {
        if (snapshot.detailItems.length) {
          detail.hidden = !defenseProfitDetailExpanded;
          detail.innerHTML = `
            <div class="defense-detail-head">
              <p class="eyebrow">Price Tracking</p>
              <strong>XRP 재매수별 방어 효과</strong>
            </div>
            <div class="defense-detail-list">
              ${snapshot.detailItems
                .map(
                  (item) => `
                    <article class="defense-detail-item">
                      <div class="defense-detail-top">
                        <strong>${escapeHtml(item.dateLabel)}</strong>
                        <span class="defense-detail-profit ${item.tone}">${formatSignedCurrency(item.profitAdded)}</span>
                      </div>
                      <p class="defense-detail-meta">
                        <span>${formatNumber(item.quantity)} XRP</span>
                        <span>재매수 평균 ${formatCurrency(item.averagePrice)}</span>
                        <span>차이 ${formatSignedCurrency(item.priceGap)}</span>
                      </p>
                      <p class="defense-detail-meta">
                        <span>누적 방어효과 ${formatSignedCurrency(item.cumulativeProfit)}</span>
                        ${item.note ? `<span>메모 ${escapeHtml(item.note)}</span>` : ""}
                      </p>
                    </article>
                  `
                )
                .join("")}
            </div>
          `;
        } else {
          detail.hidden = true;
          detail.innerHTML = "";
        }
      }
    }

    function buildXrpDefenseSnapshot({ metadata = {}, trades = {}, holdings = [], analytics = {} } = {}) {
      const startDate = parsePerformanceStartDateValue(metadata?.realizedPerformanceStartDate);
      const startLabel = startDate ? `${startDate.getMonth() + 1}월${startDate.getDate()}일` : "기준일";
      const xrpTrades = (Array.isArray(trades?.crypto) ? trades.crypto : []).filter((trade) => isXrpTradeLike(trade));
      const xrpPoolAnalytics = buildXrpRecentBuyPoolAnalytics(xrpTrades);
      const recentTenBuyCount = xrpPoolAnalytics.recentBuyCount;
      const earlySellTrades = xrpTrades.filter((trade) => {
        if (trade.side !== "매도" || !startDate) {
          return trade.side === "매도" && !startDate;
        }

        const tradeDate = parseMonthDayToDate(trade.date, startDate.getFullYear());
        return tradeDate ? tradeDate.getTime() < startDate.getTime() : false;
      });
      const rebuyTrades = xrpTrades.filter((trade) => {
        if (trade.side !== "매수") {
          return false;
        }

        if (!startDate) {
          return true;
        }

        const tradeDate = parseMonthDayToDate(trade.date, startDate.getFullYear());
        return tradeDate ? tradeDate.getTime() >= startDate.getTime() : true;
      });
      const earlySellTotals = earlySellTrades.reduce(
        (accumulator, trade) => {
          const quantity = Number(trade.quantity || 0);
          const amount = Number(trade.amount || 0);
          const fee = Number(trade.fee || 0);

          accumulator.sellQuantity += quantity;
          accumulator.sellNet += amount - fee;

          return accumulator;
        },
        {
          sellQuantity: 0,
          sellNet: 0,
        }
      );
      const xrpDefense = analytics?.xrpDefense || {};
      const earlySellAverage =
        Number.isFinite(Number(xrpDefense.averageSellNet)) && Number(xrpDefense.averageSellNet) > 0
          ? roundXrpDefenseValue(Number(xrpDefense.averageSellNet))
          : earlySellTotals.sellQuantity > 0
            ? roundXrpDefenseValue(earlySellTotals.sellNet / earlySellTotals.sellQuantity)
            : 0;
      let cumulativeProfit = 0;
      const detailItems =
        earlySellAverage > 0
          ? rebuyTrades
              .map((trade) => {
                const quantity = Number(trade.quantity || 0);
                if (!(quantity > 0)) {
                  return null;
                }

                const averagePrice = roundXrpDefenseValue((Number(trade.amount || 0) + Number(trade.fee || 0)) / quantity);
                const priceGap = roundXrpDefenseValue(earlySellAverage - averagePrice);
                const profitAdded = roundXrpDefenseValue(priceGap * quantity);
                cumulativeProfit = roundXrpDefenseValue(cumulativeProfit + profitAdded);

                return {
                  dateLabel: trade.date || "날짜 미정",
                  quantity,
                  averagePrice,
                  priceGap,
                  profitAdded,
                  cumulativeProfit,
                  note: getDisplayTradeNote(trade.note),
                  tone: toneClass(profitAdded),
                };
              })
              .filter(Boolean)
          : [];
      const rebuyQuantity = roundXrpDefenseValue(
        detailItems.reduce((total, item) => total + Number(item.quantity || 0), 0)
      );
      const xrpHolding = (Array.isArray(holdings) ? holdings : []).find((holding) => isXrpTradeLike(holding));
      const rebuyAverage =
        rebuyQuantity > 0
          ? roundXrpDefenseValue(
              detailItems.reduce((total, item) => total + Number(item.averagePrice || 0) * Number(item.quantity || 0), 0) /
                rebuyQuantity
            )
          : 0;
      const currentPrice =
        xrpHolding && Number(xrpHolding.quantity || 0) > 0
          ? Number.isFinite(Number(xrpHolding.currentPriceKrw)) && Number(xrpHolding.currentPriceKrw) > 0
            ? roundXrpDefenseValue(Number(xrpHolding.currentPriceKrw))
            : roundXrpDefenseValue(Number(xrpHolding.valuation || 0) / Number(xrpHolding.quantity || 0))
          : 0;
      const rebuyPriceGap = earlySellAverage && rebuyAverage ? roundXrpDefenseValue(earlySellAverage - rebuyAverage) : 0;
      const earlySellPremiumRate =
        earlySellAverage > 0 && currentPrice > 0 ? roundXrpDefenseValue(currentPrice / earlySellAverage - 1) : null;
      const recentTenBuyAverage = Number(xrpPoolAnalytics.recentBuyAverage || 0);
      const recentTenBuyGapRate =
        recentTenBuyAverage > 0 && currentPrice > 0 ? roundXrpDefenseValue(currentPrice / recentTenBuyAverage - 1) : null;
      const recentTenBuyQuantity = Number(xrpPoolAnalytics.recentBuyQuantity || 0);
      const recentTenBuyQuantityLabel =
        recentTenBuyQuantity > 0
          ? `최근 매수 10건 총 ${formatNumber(recentTenBuyQuantity)} XRP`
          : "";
      const defenseProfit = roundXrpDefenseValue(detailItems.reduce((total, item) => total + Number(item.profitAdded || 0), 0));
      const note = rebuyQuantity
        ? `누적 재매수 ${formatNumber(rebuyQuantity)} XRP 기준입니다. 초반 매도 평균 대비 ${formatSignedCurrency(rebuyPriceGap)} 차이와 현재가 기준 괴리율을 함께 추적합니다.`
        : earlySellAverage
          ? `초반 대량매도 평균은 ${formatCurrency(earlySellAverage)}입니다. 이후 XRP를 다시 매수하면 누적 재매수 평균과 방어 수익을 바로 계산합니다.`
          : `${startLabel} 이후 XRP 재매수 기준입니다.`;

      return {
        note,
        detailItems,
        reference: {
          earlySellAverage,
          rebuyAverage,
          currentPrice,
          recentTenBuyAverage,
          recentTenBuyGapRate,
          recentTenBuyCount,
        },
        items: [
          {
            label: "초반 대량매도 평균",
            value: earlySellAverage,
            type: "currency",
            tone: "neutral",
          },
          {
            label: "이후 누적 재매수 평균",
            value: rebuyAverage,
            type: "currency",
            tone: "neutral",
          },
          {
            label: "낮은 가격 재매수 누적 수익",
            value: defenseProfit,
            type: "currency",
            tone: toneClass(defenseProfit),
            signed: true,
            expandable: detailItems.length > 0,
            hint: detailItems.length > 0 ? "눌러서 재매수별 추가 손익 보기" : "",
          },
          {
            label: "초반 매도 평균 대비 상승률",
            value: earlySellPremiumRate || 0,
            type: "percent",
            tone: toneClass(earlySellPremiumRate || 0),
            signed: true,
            placeholder: earlySellPremiumRate == null ? "실시간 대기" : "",
            hint:
              earlySellAverage > 0 && currentPrice > 0
                ? `매도평균 ${formatCurrency(earlySellAverage)} · 현재가 ${formatCurrency(currentPrice)} (현재가가 높을수록 +)`
                : earlySellAverage > 0
                  ? `매도평균 ${formatCurrency(earlySellAverage)}`
                  : "초반 매도 데이터 대기",
          },
          {
            label: "최근 매수 10건 평균 대비 괴리율",
            value: recentTenBuyGapRate || 0,
            type: "percent",
            tone: toneClass(recentTenBuyGapRate || 0),
            signed: true,
            placeholder: recentTenBuyGapRate == null ? "실시간 대기" : "",
            hint:
              recentTenBuyAverage > 0 && currentPrice > 0
                ? `${recentTenBuyQuantityLabel} · 평균 ${formatCurrency(recentTenBuyAverage)} · 현재가 ${formatCurrency(currentPrice)} (현재가가 높을수록 +)`
                : recentTenBuyAverage > 0
                  ? `${recentTenBuyQuantityLabel} · 평균 ${formatCurrency(recentTenBuyAverage)}`
                  : "최근 매수 데이터 대기",
          },
        ],
      };
    }

    function bindDefenseSection() {
      const section = global.document.querySelector("#defense-section");
      if (!section || section.dataset.defenseBound === "true") {
        return;
      }

      bindSectionBarMenu(global.document.querySelector("#defense-asset-menu"));

      section.addEventListener("click", (event) => {
        const toggle = event.target.closest("[data-defense-profit-toggle]");
        if (!toggle || !section.contains(toggle)) {
          return;
        }

        defenseProfitDetailExpanded = !defenseProfitDetailExpanded;
        const detail = global.document.querySelector("#defense-detail");
        if (detail) {
          detail.hidden = !defenseProfitDetailExpanded;
        }
        toggle.setAttribute("aria-expanded", String(defenseProfitDetailExpanded));
      });

      section.dataset.defenseBound = "true";
    }

    return Object.freeze({
      buildXrpDefenseSnapshot,
      renderDefense,
      renderRealized,
      bindDefenseSection,
    });
  }

  global.AssetRealizedDefense = Object.freeze({
    createRealizedDefenseHelpers,
  });
})(window);
