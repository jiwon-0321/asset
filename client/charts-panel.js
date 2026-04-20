(function initAssetChartsPanel(global) {
  function createChartsHelpers(deps = {}) {
    const {
      alpha,
      formatPercent,
      formatSignedCurrency,
      formatCurrency,
      formatCompactNumber,
      formatPerformanceStartLabel,
    } = deps;

    let chartRegistry = [];

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

    function renderCharts(charts) {
      const returnsCanvas = global.document.querySelector("#returns-chart");
      const realizedCanvas = global.document.querySelector("#realized-chart");

      if (!charts) {
        if (returnsCanvas) {
          renderChartUnavailable("#returns-chart", "차트 데이터 없음");
        }
        if (realizedCanvas) {
          renderChartUnavailable("#realized-chart", "차트 데이터 없음");
        }
        return;
      }

      renderChartStats(charts);
      destroyCharts();

      if (!global.Chart) {
        if (returnsCanvas) {
          renderChartUnavailable("#returns-chart", "Chart.js 로드 실패");
        }
        if (realizedCanvas) {
          renderChartUnavailable("#realized-chart", "Chart.js 로드 실패");
        }
        return;
      }

      const hasReturns = Array.isArray(charts.returnsComparison) && charts.returnsComparison.length > 0;
      const hasRealized = Array.isArray(charts.realizedHistory) && charts.realizedHistory.length > 0;

      const theme = readChartTheme();
      const commonPlugins = {
        legend: {
          labels: {
            color: theme.mutedStrong,
            usePointStyle: true,
            pointStyle: "circle",
            padding: 16,
            boxWidth: 10,
            font: {
              family: theme.mono,
              size: 11,
              weight: "700",
            },
          },
        },
        tooltip: {
          ...buildGlassTooltipTheme(theme),
          callbacks: {
            label(context) {
              const datasetLabel = context.dataset.label ? `${context.dataset.label}: ` : "";
              if (typeof context.raw === "number") {
                return `${datasetLabel}${formatCurrency(context.raw)}`;
              }
              return `${datasetLabel}${context.formattedValue}`;
            },
          },
        },
      };

      if (returnsCanvas && !hasReturns) {
        renderChartUnavailable("#returns-chart", "차트 데이터 없음");
      } else if (returnsCanvas) {
        chartRegistry.push(
          new global.Chart(returnsCanvas, {
            type: "bar",
            data: {
              labels: charts.returnsComparison.map((item) => item.label),
              datasets: [
                {
                  label: "수익률",
                  data: charts.returnsComparison.map((item) => item.returnRate * 100),
                  borderRadius: 10,
                  borderSkipped: false,
                  backgroundColor: charts.returnsComparison.map((item) =>
                    item.returnRate >= 0 ? alpha(theme.gain, 0.78) : alpha(theme.loss, 0.78)
                  ),
                  borderColor: charts.returnsComparison.map((item) => (item.returnRate >= 0 ? theme.gain : theme.loss)),
                  borderWidth: 1.5,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: "y",
              scales: {
                x: {
                  grid: {
                    color: theme.grid,
                  },
                  ticks: {
                    color: theme.muted,
                    font: {
                      family: theme.mono,
                    },
                    callback(value) {
                      return `${value}%`;
                    },
                  },
                },
                y: {
                  grid: {
                    display: false,
                  },
                  ticks: {
                    color: theme.text,
                    font: {
                      family: theme.sans,
                      weight: "700",
                    },
                  },
                },
              },
              plugins: {
                ...commonPlugins,
                legend: {
                  display: false,
                },
                tooltip: {
                  ...commonPlugins.tooltip,
                  callbacks: {
                    label(context) {
                      return `수익률: ${Number(context.raw).toFixed(2)}%`;
                    },
                  },
                },
              },
            },
          })
        );
      }

      if (realizedCanvas && !hasRealized) {
        renderChartUnavailable("#realized-chart", "차트 데이터 없음");
      } else if (realizedCanvas) {
        chartRegistry.push(
          new global.Chart(realizedCanvas, {
            data: {
              labels: charts.realizedHistory.map((item) => item.date),
              datasets: [
                {
                  type: "bar",
                  label: "일자별 실현손익",
                  data: charts.realizedHistory.map((item) => item.dailyPnl),
                  backgroundColor: charts.realizedHistory.map((item) =>
                    item.dailyPnl >= 0 ? alpha(theme.gain, 0.6) : alpha(theme.loss, 0.2)
                  ),
                  borderColor: charts.realizedHistory.map((item) => (item.dailyPnl >= 0 ? theme.gain : alpha(theme.loss, 0.4))),
                  borderWidth: 1.2,
                  borderRadius: 8,
                  borderSkipped: false,
                  yAxisID: "y",
                },
                {
                  type: "line",
                  label: "누적 실현손익",
                  data: charts.realizedHistory.map((item) => item.cumulativePnl),
                  borderColor: theme.accent,
                  backgroundColor: alpha(theme.accent, 0.15),
                  pointBackgroundColor: theme.accent,
                  pointBorderColor: theme.surface,
                  pointRadius: 5,
                  pointHoverRadius: 6,
                  borderWidth: 3,
                  tension: 0.3,
                  fill: true,
                  yAxisID: "y",
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
                      return `${formatCompactNumber(value)}원`;
                    },
                  },
                },
              },
              plugins: {
                ...commonPlugins,
                legend: {
                  ...commonPlugins.legend,
                  position: "top",
                },
                tooltip: {
                  ...commonPlugins.tooltip,
                  filter(context) {
                    return context.dataset?.label !== "누적 실현손익";
                  },
                  callbacks: {
                    label(context) {
                      return `${context.dataset.label}: ${formatCurrency(context.raw)}`;
                    },
                    afterLabel(context) {
                      const dataIndex = context.dataIndex;
                      const historyItem = charts.realizedHistory[dataIndex];
                      if (!historyItem || !historyItem.profitDetails) {
                        return [];
                      }
                      return historyItem.profitDetails.map((detail) =>
                        `  ${detail.item}: ${formatSignedCurrency(detail.pnl)}${detail.note ? ` (${detail.note})` : ""}`
                      );
                    },
                  },
                },
              },
            },
          })
        );
      }
    }

    function renderChartStats(charts) {
      const bestReturn = Array.isArray(charts.returnsComparison) ? charts.returnsComparison[0] : null;
      setChartStat(
        "#returns-chart-stat",
        "상대 강도",
        bestReturn ? `${bestReturn.label} ${formatPercent(bestReturn.returnRate)}` : "데이터 없음"
      );

      const latestHistory = Array.isArray(charts.realizedHistory)
        ? charts.realizedHistory[charts.realizedHistory.length - 1]
        : null;
      setChartStat(
        "#realized-chart-stat",
        "매도 체결 누적",
        latestHistory ? formatSignedCurrency(latestHistory.cumulativePnl) : formatCurrency(0)
      );
    }

    function setChartStat(selector, label, value) {
      const element = global.document.querySelector(selector);
      if (!element) {
        return;
      }
      element.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    }

    function destroyCharts() {
      chartRegistry.forEach((chart) => chart.destroy());
      chartRegistry = [];
    }

    function renderChartUnavailable(selector, message) {
      const canvas = global.document.querySelector(selector);
      if (!canvas || !canvas.parentElement) {
        return;
      }
      canvas.parentElement.innerHTML = `<div class="chart-empty">${message}</div>`;
    }

    function readChartTheme() {
      const root = getComputedStyle(global.document.documentElement);
      return {
        accent: root.getPropertyValue("--accent").trim(),
        cash: root.getPropertyValue("--cash").trim(),
        gain: root.getPropertyValue("--gain").trim(),
        loss: root.getPropertyValue("--loss").trim(),
        priceUp: root.getPropertyValue("--price-up").trim(),
        priceDown: root.getPropertyValue("--price-down").trim(),
        muted: root.getPropertyValue("--muted").trim(),
        mutedStrong: root.getPropertyValue("--muted-strong").trim(),
        text: root.getPropertyValue("--text-strong").trim(),
        lineStrong: root.getPropertyValue("--line-strong").trim(),
        grid: alpha(root.getPropertyValue("--cash").trim(), 0.14),
        surface: alpha(root.getPropertyValue("--bg").trim() || "#040b0b", 0.9),
        sans: root.getPropertyValue("--font-sans").trim(),
        mono: root.getPropertyValue("--font-mono").trim(),
      };
    }

    function renderRealizedChartNote(metadata = {}) {
      const note = global.document.querySelector("#realized-chart-note");
      if (!note) {
        return;
      }

      const performanceLabel = formatPerformanceStartLabel(metadata?.realizedPerformanceStartDate);
      note.textContent = performanceLabel
        ? `${performanceLabel} 이후 매도 체결만 누적 실현손익에 반영합니다.`
        : "실시간 가격이 아니라 실제 매도 체결이 생길 때만 바뀝니다.";
    }

    return Object.freeze({
      renderCharts,
      renderChartStats,
      destroyCharts,
      renderChartUnavailable,
      readChartTheme,
      renderRealizedChartNote,
    });
  }

  global.AssetChartsPanel = Object.freeze({
    createChartsHelpers,
  });
})(window);
