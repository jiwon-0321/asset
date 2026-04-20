(function initTradeFeePolicy(globalScope) {
  const BROKER_NAME_ALIASES = Object.freeze({
    카카오증권: "카카오증권",
    카카오페이증권: "카카오증권",
    미래에셋: "미래에셋",
    미래에셋증권: "미래에셋",
    업비트: "업비트",
  });

  const BROKER_OPTIONS_BY_MARKET = Object.freeze({
    암호화폐: Object.freeze(["업비트"]),
    미국주식: Object.freeze(["카카오증권", "미래에셋"]),
    국내주식: Object.freeze(["카카오증권", "미래에셋"]),
  });

  const INITIAL_SETUP_BROKER_OPTIONS = Object.freeze(
    Object.fromEntries(
      Object.entries(BROKER_OPTIONS_BY_MARKET).map(([market, brokers]) => [
        market,
        Object.freeze(
          brokers.map((broker) =>
            Object.freeze({
              value: broker,
              label: broker,
            })
          )
        ),
      ])
    )
  );

  function normalizeNumber(value, decimals = 8) {
    if (!Number.isFinite(value)) {
      return 0;
    }

    const rounded = Number(value.toFixed(decimals));
    return Math.abs(rounded) < 1e-10 ? 0 : rounded;
  }

  function normalizeMoney(value) {
    return normalizeNumber(value, 8);
  }

  function normalizeRate(value) {
    return normalizeNumber(value, 12);
  }

  function formatRatePercent(rate, digits = 3) {
    const percent = normalizeRate(Number(rate || 0) * 100);
    return `${percent.toFixed(digits).replace(/(?:\.0+|(\.\d+?)0+)$/, "$1")}%`;
  }

  function createRateComponent(label, rate, options = {}) {
    return Object.freeze({
      kind: "rate",
      label,
      basis: options.basis || "amount",
      rate: normalizeRate(rate),
      minimumAmount: Number.isFinite(options.minimumAmount) ? Number(options.minimumAmount) : null,
      maximumAmount: Number.isFinite(options.maximumAmount) ? Number(options.maximumAmount) : null,
    });
  }

  const TRADE_FEE_RULES = Object.freeze({
    암호화폐: Object.freeze({
      업비트: Object.freeze({
        buy: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([createRateComponent("거래수수료", 0.0005)]),
          excludedComponents: Object.freeze([]),
          note: "업비트 거래수수료 0.050% 기준입니다. 출금 수수료는 거래가 아니라 별도라 앱 계산에 포함하지 않습니다.",
        }),
        sell: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([createRateComponent("거래수수료", 0.0005)]),
          excludedComponents: Object.freeze([]),
          note: "업비트 거래수수료 0.050% 기준입니다. 출금 수수료는 거래가 아니라 별도라 앱 계산에 포함하지 않습니다.",
        }),
      }),
    }),
    국내주식: Object.freeze({
      카카오증권: Object.freeze({
        buy: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([createRateComponent("거래수수료", 0.00014)]),
          excludedComponents: Object.freeze([]),
          note: "국내주식 거래수수료 추정치는 0.014% 기준입니다.",
        }),
        sell: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([
            createRateComponent("거래수수료", 0.00014),
            createRateComponent("거래세", 0.0018),
          ]),
          excludedComponents: Object.freeze([]),
          note:
            "국내주식 매도는 거래수수료 0.014%와 거래세 0.180% 추정치를 포함합니다. 실제 계좌별 유관기관 비용은 조금 다를 수 있습니다.",
        }),
      }),
      미래에셋: Object.freeze({
        buy: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([createRateComponent("거래수수료", 0.00014)]),
          excludedComponents: Object.freeze([]),
          note: "국내주식 거래수수료 추정치는 0.014% 기준입니다.",
        }),
        sell: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([
            createRateComponent("거래수수료", 0.00014),
            createRateComponent("거래세", 0.0018),
          ]),
          excludedComponents: Object.freeze([]),
          note:
            "국내주식 매도는 거래수수료 0.014%와 거래세 0.180% 추정치를 포함합니다. 실제 계좌별 유관기관 비용은 조금 다를 수 있습니다.",
        }),
      }),
    }),
    미국주식: Object.freeze({
      카카오증권: Object.freeze({
        buy: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([createRateComponent("거래수수료", 0.001)]),
          excludedComponents: Object.freeze([]),
          note: "미국주식 매수는 거래수수료 0.100% 기준 추정치입니다.",
        }),
        sell: Object.freeze({
          estimateMode: "partial",
          components: Object.freeze([createRateComponent("거래수수료", 0.001)]),
          excludedComponents: Object.freeze(["SEC fee", "FINRA TAF"]),
          note:
            "미국주식 체결값을 원화 기준으로 저장하고 있어 달러 기준 규제 fee는 아직 자동 환산하지 못합니다. 매도 시 거래수수료만 자동 반영합니다.",
        }),
      }),
      미래에셋: Object.freeze({
        buy: Object.freeze({
          estimateMode: "full",
          components: Object.freeze([createRateComponent("거래수수료", 0.0025)]),
          excludedComponents: Object.freeze([]),
          note: "미국주식 매수는 거래수수료 0.250% 기준 추정치입니다.",
        }),
        sell: Object.freeze({
          estimateMode: "partial",
          components: Object.freeze([createRateComponent("거래수수료", 0.0025)]),
          excludedComponents: Object.freeze(["SEC fee", "FINRA TAF"]),
          note:
            "미국주식 체결값을 원화 기준으로 저장하고 있어 달러 기준 규제 fee는 아직 자동 환산하지 못합니다. 매도 시 거래수수료만 자동 반영합니다.",
        }),
      }),
    }),
  });

  function normalizeBrokerName(value = "") {
    return BROKER_NAME_ALIASES[String(value || "").trim()] || String(value || "").trim();
  }

  function resolveTradeFeeSideKey(side = "") {
    return side === "매도" ? "sell" : "buy";
  }

  function resolveTradeFeeRule({ broker, market, side } = {}) {
    const normalizedBroker = normalizeBrokerName(broker);
    const normalizedMarket = String(market || "").trim();
    if (!normalizedBroker || !normalizedMarket) {
      return null;
    }

    const marketRules = TRADE_FEE_RULES[normalizedMarket];
    if (!marketRules) {
      return null;
    }

    const brokerRules = marketRules[normalizedBroker];
    if (!brokerRules) {
      return null;
    }

    return brokerRules[resolveTradeFeeSideKey(side)] || null;
  }

  function calculateTradeFeeComponentAmount(component = {}, context = {}) {
    const basis = component.basis || "amount";
    const baseValue = basis === "quantity" ? Number(context.quantity || 0) : Number(context.amount || 0);
    if (!Number.isFinite(baseValue) || baseValue <= 0) {
      return 0;
    }

    let amount = baseValue * Number(component.rate || 0);

    if (Number.isFinite(component.minimumAmount) && amount > 0) {
      amount = Math.max(amount, Number(component.minimumAmount));
    }

    if (Number.isFinite(component.maximumAmount) && amount > 0) {
      amount = Math.min(amount, Number(component.maximumAmount));
    }

    return normalizeMoney(amount);
  }

  function describeTradeFeePolicy({ broker, market, side } = {}) {
    const rule = resolveTradeFeeRule({ broker, market, side });
    if (!rule) {
      return {
        estimateMode: "unknown",
        includedComponents: [],
        excludedComponents: [],
        note: "",
      };
    }

    return {
      estimateMode: rule.estimateMode || "full",
      includedComponents: (rule.components || []).map((component) => {
        const rateCopy = formatRatePercent(component.rate, 3);
        const basisCopy = component.basis === "quantity" ? "수량 기준" : rateCopy;
        return `${component.label} ${basisCopy}`.trim();
      }),
      excludedComponents: [...(rule.excludedComponents || [])],
      note: rule.note || "",
    };
  }

  function buildTradeFeeSummaryText({ broker, market, side } = {}) {
    if (!broker || !market) {
      return "플랫폼 선택 필요";
    }

    const description = describeTradeFeePolicy({ broker, market, side });
    if (!description.includedComponents.length) {
      return "기준 없음";
    }

    const parts = [description.includedComponents.join(" + ")];
    if (description.excludedComponents.length) {
      parts.push(`${description.excludedComponents.join(", ")} 별도`);
    }
    return parts.join(" · ");
  }

  function estimateTradeFee({ broker, market, side, amount, quantity } = {}) {
    const rule = resolveTradeFeeRule({ broker, market, side });
    if (!rule) {
      return {
        totalFee: 0,
        estimateMode: "unknown",
        components: [],
        excludedComponents: [],
        note: "",
      };
    }

    const normalizedAmount = Number(amount || 0);
    const normalizedQuantity = Number(quantity || 0);
    const components = (rule.components || []).map((component) =>
      Object.freeze({
        ...component,
        amount: calculateTradeFeeComponentAmount(component, {
          amount: normalizedAmount,
          quantity: normalizedQuantity,
        }),
      })
    );

    return {
      totalFee: normalizeMoney(components.reduce((total, component) => total + Number(component.amount || 0), 0)),
      estimateMode: rule.estimateMode || "full",
      components,
      excludedComponents: [...(rule.excludedComponents || [])],
      note: rule.note || "",
    };
  }

  function buildMarketTradeFeeHelpText(market = "") {
    const normalizedMarket = String(market || "").trim();

    if (normalizedMarket === "암호화폐") {
      return TRADE_FEE_RULES.암호화폐.업비트.buy.note;
    }

    if (normalizedMarket === "미국주식") {
      return [
        TRADE_FEE_RULES.미국주식.카카오증권.buy.note,
        TRADE_FEE_RULES.미국주식.미래에셋.buy.note,
        TRADE_FEE_RULES.미국주식.카카오증권.sell.note,
      ].join(" ");
    }

    if (normalizedMarket === "국내주식") {
      return [
        TRADE_FEE_RULES.국내주식.카카오증권.sell.note,
        "브로커별 체결 이벤트나 계좌 우대 조건이 있으면 실제 청구액과 약간 다를 수 있습니다.",
      ].join(" ");
    }

    return "";
  }

  const api = Object.freeze({
    BROKER_NAME_ALIASES,
    BROKER_OPTIONS_BY_MARKET,
    INITIAL_SETUP_BROKER_OPTIONS,
    TRADE_FEE_RULES,
    normalizeBrokerName,
    formatRatePercent,
    resolveTradeFeeRule,
    describeTradeFeePolicy,
    buildTradeFeeSummaryText,
    estimateTradeFee,
    buildMarketTradeFeeHelpText,
  });

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  globalScope.AssetTradeFeePolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
