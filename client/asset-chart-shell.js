(function registerAssetChartShell(global) {
  const escapeHtml = (...args) => global.escapeHtml(...args);
  const setInnerHtmlIfChanged = (...args) => global.setInnerHtmlIfChanged(...args);
  const formatNumber = (...args) => global.formatNumber(...args);
  const formatCurrency = (...args) => global.formatCurrency(...args);
  const formatSignedCurrency = (...args) => global.formatSignedCurrency(...args);
  const formatSignedPercent = (...args) => global.formatSignedPercent(...args);
  const formatDateTime = (...args) => global.formatDateTime(...args);
  const formatUsd = (...args) => global.formatUsd(...args);
  const formatSignedUsd = (...args) => global.formatSignedUsd(...args);
  const formatCompactNumber = (...args) => global.formatCompactNumber(...args);
  const formatCompactCurrency = (...args) => global.formatCompactCurrency(...args);
  const alpha = (...args) => global.alpha(...args);
  const getSignedPriceToneClass = (...args) => global.getSignedPriceToneClass(...args);
  const readChartTheme = (...args) =>
    typeof global.readChartTheme === "function" ? global.readChartTheme(...args) : null;
  const getAssetChartRanges = (...args) =>
    typeof global.getAssetChartRanges === "function" ? global.getAssetChartRanges(...args) : [];
  const getDefaultAssetChartRange = (...args) =>
    typeof global.getDefaultAssetChartRange === "function" ? global.getDefaultAssetChartRange(...args) : "1M";
  const requestAssetChartSnapshot = async (options) => {
    const { market, symbol, name, range = "1M", granularity = "day" } = options || {};
    const url = new URL("./api/asset-chart", global.location.origin);
    url.searchParams.set("market", market);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("name", name || symbol);
    url.searchParams.set("range", range);
    url.searchParams.set("granularity", granularity);

    const response = await global.fetchWithAccess(url.toString(), {
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || "차트 데이터를 불러오지 못했습니다.");
    }

    return payload;
  };

  let assetChartState = {
    market: "",
    symbol: "",
    name: "",
    range: "1M",
    granularity: "day",
  };
  let assetDetailChart = null;
  let assetChartRefreshTimer = null;

  function readFallbackChartTheme() {
    const root = global.getComputedStyle(global.document.documentElement);
    const readToken = (name, fallback = "") => {
      const value = root.getPropertyValue(name).trim();
      return value || fallback;
    };
    const cash = readToken("--cash", "#5ac8fa");
    const accent = readToken("--accent", "#0071e3");
    const gain = readToken("--gain", "#34c759");
    const loss = readToken("--loss", "#ff375f");
    const bg = readToken("--bg", "#f5f5f7");

    return {
      accent,
      cash,
      gain,
      loss,
      priceUp: readToken("--price-up", gain),
      priceDown: readToken("--price-down", loss),
      muted: readToken("--muted", "#6e6e73"),
      mutedStrong: readToken("--muted-strong", "#515154"),
      text: readToken("--text-strong", "#1d1d1f"),
      lineStrong: readToken("--line-strong", alpha(cash, 0.16)),
      grid: alpha(cash, 0.12),
      surface: alpha(bg, 0.92),
      sans: readToken("--font-sans", "sans-serif"),
      mono: readToken("--font-mono", "monospace"),
    };
  }

  function resolveChartTheme() {
    return readChartTheme() || readFallbackChartTheme();
  }

  function buildGlassTooltipTheme(theme) {
    const tooltipBorder = alpha(theme.accent || theme.cash || "#0071e3", 0.18);
    return {
      backgroundColor: "rgba(255, 255, 255, 0.96)",
      borderColor: tooltipBorder,
      borderWidth: 1,
      titleColor: theme.text,
      bodyColor: theme.text,
      displayColors: false,
      padding: 12,
      cornerRadius: 14,
      titleFont: {
        family: theme.sans,
        weight: "700",
      },
      bodyFont: {
        family: theme.sans,
      },
    };
  }

  function buildFxSourceLabel(source = "") {
    const normalized = String(source || "").trim().toLowerCase();
    if (normalized === "twelve-data") {
      return "Twelve Data";
    }
    if (normalized === "yahoo-finance") {
      return "Yahoo Finance";
    }
    if (normalized === "fallback") {
      return "Fallback";
    }
    return normalized ? source : "FX API";
  }

  function formatUsdKrwRate(value) {
    const numeric = global.toFiniteNumber(value);
    if (numeric == null || numeric <= 0) {
      return "연결 대기";
    }
    return `${formatNumber(numeric)}원 / $1`;
  }

  function renderFxPricePillMarkup(fx = {}) {
    const hasRate = global.toFiniteNumber(fx.usdkrw) != null && Number(fx.usdkrw) > 0;
    const quoteStateClass = hasRate ? "" : " price-pill--inactive";
    const staleClass = fx?.isDelayed ? " price-pill--stale" : "";
    const statusCopy = fx?.isDelayed ? "업데이트 지연" : "실시간";
    const sourceCopy = buildFxSourceLabel(fx?.source);
    const updatedCopy = fx?.updatedAt ? formatDateTime(fx.updatedAt) : "업데이트 대기";

    return `
      <button
        type="button"
        class="price-pill price-pill--fx price-pill--global price-pill--static${quoteStateClass}${staleClass}"
        data-asset-chart-trigger
        data-asset-chart-name="USD/KRW"
        data-asset-chart-market="fx"
        data-asset-chart-symbol="KRW=X"
        aria-label="USD/KRW 차트 보기"
      >
        <div class="price-copy">
          <span class="price-name">원/달러</span>
          <span class="price-meta">USD/KRW · ${statusCopy}</span>
        </div>
        <div class="price-value-wrap">
          <strong class="price-value price-move-neutral">${escapeHtml(formatUsdKrwRate(fx.usdkrw))}</strong>
          <span class="price-secondary">${escapeHtml(`${sourceCopy} · ${updatedCopy}`)}</span>
        </div>
      </button>
    `;
  }

  function renderFxPriceSection(fx = {}) {
    return `
      <section class="price-sector price-sector--fx">
        <div class="price-sector-head">
          <span class="price-sector-label">환율</span>
          <span class="price-sector-count">USD/KRW</span>
        </div>
        <div class="price-sector-list">
          ${renderFxPricePillMarkup(fx)}
        </div>
      </section>
    `;
  }

  function renderPriceStrip(quotes = {}, holdings = [], targets = {}, fx = {}, indices = {}) {
    const container = document.querySelector("#price-strip");
    if (!container) {
      return;
    }

    const instruments = global.collectTrackedQuoteItems(holdings, targets);
    const majorIndicesSectionMarkup =
      typeof global.renderMajorIndicesSection === "function" ? global.renderMajorIndicesSection(indices) : "";
    const fxSectionMarkup = renderFxPriceSection(fx);
    if (!instruments.length) {
      setInnerHtmlIfChanged(container, `${majorIndicesSectionMarkup}${fxSectionMarkup}`);
      return;
    }

    const sections = [
      { key: "crypto", label: "암호화폐", tone: "crypto" },
      { key: "us-stock", label: "미국주식", tone: "global" },
      { key: "kr-stock", label: "국내주식", tone: "domestic" },
    ];

    const marketSectionsMarkup = sections
      .map((section) => {
        const items = instruments.filter((instrument) => instrument.market === section.key);
        if (!items.length) {
          return "";
        }

        return `
          <section class="price-sector price-sector--${section.tone}">
            <div class="price-sector-head">
              <span class="price-sector-label">${escapeHtml(section.label)}</span>
              <span class="price-sector-count">${formatNumber(items.length)}종목</span>
            </div>
            <div class="price-sector-list">
              ${items.map((instrument) => global.renderPricePillMarkup(instrument, quotes, fx)).join("")}
            </div>
          </section>
        `;
      })
      .join("");

    setInnerHtmlIfChanged(container, `${marketSectionsMarkup}${majorIndicesSectionMarkup}${fxSectionMarkup}`);
  }

  function destroyAssetChartModalChart() {
    if (assetDetailChart) {
      assetDetailChart.destroy();
      assetDetailChart = null;
    }
  }

  function ensureAssetChartCanvas() {
    const wrap = document.querySelector("#asset-chart-canvas-wrap");
    if (!wrap) {
      return null;
    }

    wrap.innerHTML = `<canvas id="asset-chart-canvas"></canvas>`;
    return wrap.querySelector("#asset-chart-canvas");
  }

  function clearAssetChartRefreshTimer() {
    if (assetChartRefreshTimer) {
      global.clearTimeout(assetChartRefreshTimer);
      assetChartRefreshTimer = null;
    }
  }

  function setAssetChartCanvasMessage(message) {
    const wrap = document.querySelector("#asset-chart-canvas-wrap");
    if (!wrap) {
      return;
    }

    destroyAssetChartModalChart();
    wrap.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
  }

  function setActiveAssetChartGranularity(granularity = "day") {
    document.querySelectorAll("[data-asset-chart-granularity]").forEach((button) => {
      const isActive = button.dataset.assetChartGranularity === granularity;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function renderAssetChartRangeTabs(granularity = assetChartState.granularity || "day", rangeKey = assetChartState.range || "1M") {
    const ranges = getAssetChartRanges(granularity);
    document.querySelectorAll("[data-asset-chart-range]").forEach((button, index) => {
      const range = ranges[index];
      if (!range) {
        button.hidden = true;
        return;
      }

      button.hidden = false;
      button.dataset.assetChartRange = range.key;
      button.textContent = range.label;
      const isActive = range.key === rangeKey;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  }

  function setActiveAssetChartRange(rangeKey = "1M", granularity = assetChartState.granularity || "day") {
    renderAssetChartRangeTabs(granularity, rangeKey);
  }

  function syncAssetChartRangeVisibility(granularity = "day") {
    const nextGranularity = "day";
    const ranges = getAssetChartRanges(nextGranularity);
    const fallbackRange = getDefaultAssetChartRange(nextGranularity);
    const isSupported = ranges.some((item) => item.key === assetChartState.range);
    const nextRange = isSupported ? assetChartState.range : fallbackRange;

    assetChartState = {
      ...assetChartState,
      granularity: nextGranularity,
      range: nextRange,
    };

    renderAssetChartRangeTabs(nextGranularity, nextRange);
  }

  function isClosestCapableElement(value) {
    return Boolean(value && value.nodeType === 1 && typeof value.closest === "function");
  }

  function getEventElementTarget(event) {
    if (typeof event?.composedPath === "function") {
      const candidate = event.composedPath().find((entry) => isClosestCapableElement(entry));
      if (candidate) {
        return candidate;
      }
    }

    const directTarget = event?.target;
    if (isClosestCapableElement(directTarget)) {
      return directTarget;
    }

    if (isClosestCapableElement(directTarget?.parentElement)) {
      return directTarget.parentElement;
    }

    if (isClosestCapableElement(directTarget?.parentNode)) {
      return directTarget.parentNode;
    }

    return null;
  }

  function closestFromEvent(event, selector) {
    const target = getEventElementTarget(event);
    return target ? target.closest(selector) : null;
  }

  function renderAssetChartRefreshHint(snapshot = null) {
    const target = document.querySelector("#asset-chart-refresh");
    if (!target) {
      return;
    }

    const updatedAt = snapshot?.summary?.updatedAt ? formatDateTime(snapshot.summary.updatedAt) : "";
    target.textContent = updatedAt ? `열 때 갱신 · 최근 반영 ${updatedAt}` : "열 때 갱신 · 새 차트 대기 중";
  }

  function renderAssetChartStats(snapshot) {
    const stats = document.querySelector("#asset-chart-stats");
    if (!stats) {
      return;
    }

    const market = snapshot?.instrument?.market || "";
    const latest = Number(snapshot?.summary?.latest || 0);
    const changeAmount = Number(snapshot?.summary?.changeAmount || 0);
    const changePercent = Number(snapshot?.summary?.changePercent || 0);
    const updatedAt = snapshot?.summary?.updatedAt ? formatDateTime(snapshot.summary.updatedAt) : "시간 정보 없음";

    stats.innerHTML = `
      <article class="asset-chart-stat">
        <span>현재가</span>
        <strong>${escapeHtml(formatAssetChartValue(latest, market))}</strong>
      </article>
      <article class="asset-chart-stat">
        <span>${escapeHtml(snapshot?.rangeLabel || "기간 변화")}</span>
        <strong class="${getSignedPriceToneClass(changeAmount)}">${escapeHtml(
          `${formatSignedAssetChartChange(changeAmount, market)} · ${formatSignedPercent(changePercent)}`
        )}</strong>
      </article>
      <article class="asset-chart-stat">
        <span>업데이트</span>
        <strong>${escapeHtml(updatedAt)}</strong>
      </article>
    `;
  }

  function formatAssetChartValue(value, market) {
    if (market === "us-stock") {
      return formatUsd(value);
    }
    if (market === "fx") {
      return formatUsdKrwRate(value);
    }
    if (market === "major-index") {
      return formatNumber(value);
    }
    return formatCurrency(value);
  }

  function formatSignedAssetChartChange(value, market) {
    if (market === "us-stock") {
      return formatSignedUsd(value);
    }
    if (market === "fx") {
      const numeric = Number(value || 0);
      const delta = `${formatNumber(Math.abs(numeric))}원`;
      if (numeric > 0) {
        return `+${delta}`;
      }
      if (numeric < 0) {
        return `-${delta}`;
      }
      return delta;
    }
    if (market === "major-index") {
      const numeric = Number(value || 0);
      return numeric > 0 ? `+${formatNumber(numeric)}` : formatNumber(numeric);
    }
    return formatSignedCurrency(value);
  }

  function formatCompactAssetChartTick(value, market) {
    if (market === "us-stock") {
      return formatUsd(value);
    }
    if (market === "fx") {
      return formatCompactNumber(value);
    }
    if (market === "major-index") {
      return formatCompactNumber(value);
    }
    return formatCompactCurrency(value);
  }

  function renderAssetChart(snapshot) {
    const title = document.querySelector("#asset-chart-title");
    const summary = document.querySelector("#asset-chart-summary");
    const footnote = document.querySelector("#asset-chart-footnote");
    const points = Array.isArray(snapshot?.points) ? snapshot.points : [];

    if (title) {
      title.textContent = snapshot?.instrument?.name || "종목 차트";
    }
    if (summary) {
      summary.textContent = `${snapshot?.rangeLabel || "최근 흐름"} · ${snapshot?.sourceLabel || "일봉"}`;
    }
    if (footnote) {
      footnote.textContent =
        snapshot?.instrument?.market === "us-stock"
          ? "미국주식 차트는 선택한 기간 기준 종가 흐름을 보여주며, 다시 열 때 최신 상태로 갱신됩니다."
          : snapshot?.instrument?.market === "fx"
            ? "환율 차트는 Yahoo Finance 기준 USD/KRW 흐름을 보여주며, 다시 열 때 최신 상태로 갱신됩니다."
            : snapshot?.instrument?.market === "major-index"
              ? "주요지수 차트는 Yahoo Finance 기준 지수 흐름을 보여주며, 다시 열 때 최신 상태로 갱신됩니다."
              : "암호화폐 차트는 선택한 기간 기준 업비트 일봉 흐름을 보여주며, 다시 열 때 최신 상태로 갱신됩니다.";
    }

    renderAssetChartStats(snapshot);
    renderAssetChartRefreshHint(snapshot);

    if (!global.Chart) {
      setAssetChartCanvasMessage("Chart.js 로드 실패");
      return;
    }

    if (!points.length) {
      setAssetChartCanvasMessage("차트 데이터가 없습니다.");
      return;
    }

    destroyAssetChartModalChart();
    const canvas = ensureAssetChartCanvas();
    if (!canvas) {
      return;
    }

    const theme = resolveChartTheme();
    const market = snapshot?.instrument?.market || "";
    const changeAmount = Number(snapshot?.summary?.changeAmount || 0);
    const lineColor = changeAmount >= 0 ? theme.priceUp : theme.priceDown;

    assetDetailChart = new global.Chart(canvas, {
      type: "line",
      data: {
        labels: points.map((item) => item.label),
        datasets: [
          {
            label: "종가",
            data: points.map((item) => item.close),
            borderColor: lineColor,
            backgroundColor: alpha(lineColor, 0.12),
            fill: true,
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.28,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        scales: {
          x: {
            grid: {
              color: alpha(theme.cash, 0.08),
            },
            ticks: {
              color: theme.muted,
              font: {
                family: theme.mono,
              },
            },
          },
          y: {
            grid: {
              color: theme.grid,
            },
            ticks: {
              color: theme.muted,
              font: {
                family: theme.mono,
              },
              callback(value) {
                return formatCompactAssetChartTick(value, market);
              },
            },
          },
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            ...buildGlassTooltipTheme(theme),
            callbacks: {
              label(context) {
                const point = points[context.dataIndex];
                if (!point) {
                  return "";
                }

                return [
                  `종가: ${formatAssetChartValue(point.close, market)}`,
                  `고가: ${formatAssetChartValue(point.high, market)}`,
                  `저가: ${formatAssetChartValue(point.low, market)}`,
                ];
              },
            },
          },
        },
      },
    });
  }

  function closeAssetChartModal() {
    const modal = document.querySelector("#asset-chart-modal");
    if (!modal) {
      return;
    }

    clearAssetChartRefreshTimer();
    destroyAssetChartModalChart();
    modal.hidden = true;
    document.body.classList.remove("asset-chart-open");
  }

  async function loadAssetChartModal(options = {}) {
    const { silent = false } = options;
    const modal = document.querySelector("#asset-chart-modal");
    const title = document.querySelector("#asset-chart-title");
    const summary = document.querySelector("#asset-chart-summary");
    const stats = document.querySelector("#asset-chart-stats");
    const footnote = document.querySelector("#asset-chart-footnote");
    const market = assetChartState.market;
    const symbol = assetChartState.symbol;
    const name = assetChartState.name;
    const range = assetChartState.range || "1M";
    const granularity = assetChartState.granularity || "day";

    if (!modal || !market || !symbol) {
      return;
    }

    clearAssetChartRefreshTimer();

    if (title) {
      title.textContent = name || symbol || "종목 차트";
    }
    if (summary && !silent) {
      summary.textContent = "최근 흐름을 불러오는 중입니다.";
    }
    if (stats && !silent) {
      stats.innerHTML = "";
    }
    if (footnote && !silent) {
      footnote.textContent = "";
    }
    if (!silent) {
      setAssetChartCanvasMessage("차트 데이터를 불러오는 중입니다.");
    }
    renderAssetChartRefreshHint();

    try {
      const snapshot = await requestAssetChartSnapshot({ market, symbol, name, range, granularity });
      renderAssetChart(snapshot);
    } catch (error) {
      if (summary) {
        summary.textContent = error.message || "차트 데이터를 불러오지 못했습니다.";
      }
      setAssetChartCanvasMessage(error.message || "차트 데이터를 불러오지 못했습니다.");
      renderAssetChartRefreshHint();
    }
  }

  async function openAssetChartModal({ market, symbol, name, range = "1M", granularity = "day" }) {
    const modal = document.querySelector("#asset-chart-modal");
    if (!modal) {
      return;
    }

    clearAssetChartRefreshTimer();
    const nextGranularity = "day";
    const supportedRanges = getAssetChartRanges(nextGranularity);
    const nextRange = supportedRanges.some((item) => item.key === range) ? range : getDefaultAssetChartRange(nextGranularity);
    assetChartState = {
      market,
      symbol,
      name,
      range: nextRange,
      granularity: nextGranularity,
    };

    setActiveAssetChartGranularity(nextGranularity);
    syncAssetChartRangeVisibility(nextGranularity);
    modal.hidden = false;
    document.body.classList.add("asset-chart-open");
    await loadAssetChartModal();
  }

  function bindPriceStripInteractions() {
    const strip = document.querySelector("#price-strip");
    const modal = document.querySelector("#asset-chart-modal");
    if (strip && strip.dataset.chartBound !== "true") {
      strip.addEventListener("click", (event) => {
        if (Date.now() < (typeof interactionLockUntil === "number" ? interactionLockUntil : 0) || document.body.classList.contains("access-locked")) {
          return;
        }

        const trigger = closestFromEvent(event, "[data-asset-chart-trigger]");
        if (!trigger || !strip.contains(trigger)) {
          return;
        }

        openAssetChartModal({
          market: trigger.dataset.assetChartMarket || "",
          symbol: trigger.dataset.assetChartSymbol || "",
          name: trigger.dataset.assetChartName || "",
        });
      });
      strip.dataset.chartBound = "true";
    }

    if (modal && modal.dataset.bound !== "true") {
      modal.addEventListener("click", (event) => {
        const target = getEventElementTarget(event);
        const rangeButton = target ? target.closest("[data-asset-chart-range]") : null;
        if (rangeButton && modal.contains(rangeButton)) {
          const nextRange = rangeButton.dataset.assetChartRange || "1M";
          if (assetChartState.range !== nextRange) {
            assetChartState = {
              ...assetChartState,
              range: nextRange,
            };
            setActiveAssetChartRange(nextRange, assetChartState.granularity);
            loadAssetChartModal();
          }
          return;
        }

        if (target === modal || (target && target.closest("[data-asset-chart-close]"))) {
          closeAssetChartModal();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !modal.hidden) {
          closeAssetChartModal();
        }
      });

      modal.dataset.bound = "true";
    }
  }

  global.AssetChartShell = Object.freeze({
    renderPriceStrip,
    bindPriceStripInteractions,
    closeAssetChartModal,
    openAssetChartModal,
  });
})(window);
