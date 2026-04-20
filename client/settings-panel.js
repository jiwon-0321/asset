(function initAssetSettingsPanel(global) {
  function createSettingsPanelHelpers(deps = {}) {
    const {
      MOBILE_SECTION_SHORTCUTS,
      LIVE_PRICE_TOGGLE_OPTIONS,
      EMPTY_BOARD_VARIANT,
      SETTINGS_SECTION_ID,
      DEFAULT_LIVE_PRICE_PREFERENCES,
      getBoardVariant,
      getToggleableSectionOptions,
      isEmptyBoardVariant,
      hasMeaningfulBoardContent,
      getShortcutSummary,
      getDefaultVisibleSectionIds,
      normalizeVisibleSectionIds,
      normalizeLivePricePreferencesState,
      normalizeTradeQuickAssetsState,
      normalizeHiddenHoldingsState,
      escapeHtml,
      setInnerHtmlIfChanged,
      getDisplayAssetName,
      getCurrentUiPreferences,
      getCurrentPortfolioData,
      getBasePortfolioData,
      getMobileSectionState,
      closeMobileSectionOverlay,
      queueUiPreferencesMutation,
      openGuideDestination,
      restoreHoldingPosition,
      showAppToast,
      setSettingsStatus,
      getPendingUiPreferencesMutation,
      getUiPreferencesSavePromise,
    } = deps;

    function getVisibleSectionIds() {
      return Array.isArray(getCurrentUiPreferences?.()?.visibleSections) ? getCurrentUiPreferences().visibleSections : [];
    }

    function getLivePricePreferences() {
      return normalizeLivePricePreferencesState(getCurrentUiPreferences?.()?.livePrice || {});
    }

    function getTradeQuickAssets() {
      return normalizeTradeQuickAssetsState(getCurrentUiPreferences?.()?.tradeQuickAssets || []);
    }

    function getHiddenHoldings() {
      return normalizeHiddenHoldingsState(getCurrentUiPreferences?.()?.hiddenHoldings || []);
    }

    function shouldShowGlobalIndices() {
      return getLivePricePreferences().showGlobalIndices !== false;
    }

    function isSectionVisible(sectionId = "") {
      const normalizedId = String(sectionId || "").trim();
      if (!normalizedId) {
        return false;
      }
      if (normalizedId === "guide-section") {
        return getBoardVariant() === EMPTY_BOARD_VARIANT && getVisibleSectionIds().includes(normalizedId);
      }
      if (normalizedId === SETTINGS_SECTION_ID) {
        return true;
      }
      if (normalizedId === "strategy-section") {
        return getBoardVariant() !== EMPTY_BOARD_VARIANT;
      }
      return getVisibleSectionIds().includes(normalizedId);
    }

    function getVisibleMobileShortcuts() {
      return MOBILE_SECTION_SHORTCUTS.filter((item) => isSectionVisible(item.id));
    }

    function renderMobileSectionHub() {
      const container = global.document.querySelector("#mobile-hub-grid");
      if (!container) {
        return;
      }

      container.innerHTML = getVisibleMobileShortcuts()
        .map((item) => {
          const summary = getShortcutSummary(item);
          return `
            <button type="button" class="mobile-hub-button" data-mobile-section-open="${escapeHtml(item.id)}">
              <div class="mobile-hub-button-top">
                <span class="mobile-hub-button-icon" aria-hidden="true">${escapeHtml(item.icon || "•")}</span>
                <span class="mobile-hub-button-eyebrow">${escapeHtml(item.eyebrow)}</span>
              </div>
              <strong class="mobile-hub-button-title">${escapeHtml(item.title)}</strong>
              <span class="mobile-hub-button-summary">${escapeHtml(summary)}</span>
            </button>
          `;
        })
        .join("");
    }

    function renderSettingsSection() {
      const container = global.document.querySelector("#settings-option-list");
      const utilityContainer = global.document.querySelector("#settings-utility-list");
      if (!container) {
        return;
      }

      const visibleSections = new Set(getVisibleSectionIds());
      const sectionOptionsMarkup = getToggleableSectionOptions()
        .map((item) => {
          const checked = visibleSections.has(item.id) ? "checked" : "";
          return `
            <label class="settings-option" data-settings-option="${escapeHtml(item.id)}">
              <input type="checkbox" data-settings-section-toggle="${escapeHtml(item.id)}" ${checked} />
              <span class="settings-option-box">
                <span class="settings-option-copy">
                  <strong>${escapeHtml(item.title)}</strong>
                  <span>${escapeHtml(item.eyebrow)}</span>
                </span>
                <span class="settings-option-check" aria-hidden="true"></span>
              </span>
            </label>
          `;
        })
        .join("");

      const livePriceOptionsMarkup = LIVE_PRICE_TOGGLE_OPTIONS.map((item) => {
        const checked = shouldShowGlobalIndices() ? "checked" : "";
        return `
          <label class="settings-option" data-settings-live-option="${escapeHtml(item.id)}">
            <input type="checkbox" data-settings-live-price-toggle="${escapeHtml(item.id)}" ${checked} />
            <span class="settings-option-box">
              <span class="settings-option-copy">
                <strong>${escapeHtml(item.title)}</strong>
                <span>${escapeHtml(item.eyebrow)}</span>
              </span>
              <span class="settings-option-check" aria-hidden="true"></span>
            </span>
          </label>
        `;
      }).join("");

      setInnerHtmlIfChanged(container, `${sectionOptionsMarkup}${livePriceOptionsMarkup}`);

      if (!utilityContainer) {
        return;
      }

      const utilityCards = [];
      const hiddenHoldingItems = getHiddenHoldings();

      if (hiddenHoldingItems.length) {
        utilityCards.push(`
          <article class="settings-utility-card">
            <div class="settings-utility-copy">
              <p class="settings-kicker">Positions</p>
              <h3 class="settings-title">숨긴 보유 종목</h3>
              <p class="settings-summary">거래 타임라인은 그대로 두고 보유 카드에서만 숨긴 종목입니다. 다시 보기로 언제든 복원할 수 있습니다.</p>
            </div>
            <div class="holding-restore-list holding-restore-list--settings">
              ${hiddenHoldingItems
                .map((item) => {
                  const displayName = getDisplayAssetName({
                    asset: item.asset,
                    symbol: item.symbol,
                    market: item.market,
                  });
                  return `
                    <button
                      type="button"
                      class="status-tag status-tag--action"
                      data-holding-restore-market="${escapeHtml(item.market || "")}"
                      data-holding-restore-symbol="${escapeHtml(item.symbol || "")}"
                      data-holding-restore-asset="${escapeHtml(item.asset || "")}"
                    >
                      ${escapeHtml(displayName)} 다시 보기
                    </button>
                  `;
                })
                .join("")}
            </div>
          </article>
        `);
      }

      if (isEmptyBoardVariant()) {
        const currentData = getCurrentPortfolioData?.() || getBasePortfolioData?.() || {};
        const hasContent = hasMeaningfulBoardContent(currentData);
        utilityCards.push(
          hasContent
            ? `
              <article class="settings-utility-card settings-utility-card--muted">
                <div class="settings-utility-copy">
                  <p class="settings-kicker">Setup</p>
                  <h3 class="settings-title">시작 자산 입력</h3>
                  <p class="settings-summary">초기 설정이 완료되어 메인에서는 숨겨집니다. 시작 기준을 다시 바꾸는 기능은 다음 단계에서 안전하게 추가할 예정입니다.</p>
                </div>
              </article>
            `
            : `
              <article class="settings-utility-card">
                <div class="settings-utility-copy">
                  <p class="settings-kicker">Setup</p>
                  <h3 class="settings-title">시작 자산 입력</h3>
                  <p class="settings-summary">보드를 시작하기 전, 기준이 되는 현금과 현재 보유 종목을 먼저 입력합니다.</p>
                </div>
                <div class="settings-utility-actions">
                  <button type="button" class="btn-secondary" data-settings-open-initial-setup>시작 자산 입력 열기</button>
                </div>
              </article>
            `
        );
      }

      utilityContainer.hidden = utilityCards.length === 0;
      setInnerHtmlIfChanged(utilityContainer, utilityCards.join(""));
    }

    function applySectionVisibility() {
      const mobileSectionState = getMobileSectionState?.() || {};
      if (mobileSectionState.sectionId && !isSectionVisible(mobileSectionState.sectionId)) {
        closeMobileSectionOverlay();
      }

      MOBILE_SECTION_SHORTCUTS.forEach((item) => {
        const section = global.document.getElementById(item.id);
        if (!section) {
          return;
        }

        const visible = isSectionVisible(item.id);
        section.hidden = !visible;
        section.setAttribute("aria-hidden", visible ? "false" : "true");
        section.classList.toggle("section-hidden", !visible);
      });
    }

    function areVisibleSectionListsEqual(left = [], right = []) {
      const normalizedLeft = normalizeVisibleSectionIds(left, getBoardVariant());
      const normalizedRight = normalizeVisibleSectionIds(right, getBoardVariant());
      if (normalizedLeft.length !== normalizedRight.length) {
        return false;
      }

      return normalizedLeft.every((value, index) => value === normalizedRight[index]);
    }

    function areComparableAssetItemListsEqual(left = [], right = [], normalizeItems = (value) => value) {
      const normalizedLeft = normalizeItems(left);
      const normalizedRight = normalizeItems(right);
      if (normalizedLeft.length !== normalizedRight.length) {
        return false;
      }

      return normalizedLeft.every((item, index) => {
        const rightItem = normalizedRight[index] || {};
        return (
          item.market === rightItem.market &&
          item.asset === rightItem.asset &&
          item.symbol === rightItem.symbol
        );
      });
    }

    function areLivePricePreferencesEqual(left = {}, right = {}) {
      const normalizedLeft = normalizeLivePricePreferencesState(left);
      const normalizedRight = normalizeLivePricePreferencesState(right);
      return normalizedLeft.showGlobalIndices === normalizedRight.showGlobalIndices;
    }

    function areTradeQuickAssetsEqual(left = [], right = []) {
      return areComparableAssetItemListsEqual(left, right, normalizeTradeQuickAssetsState);
    }

    function areHiddenHoldingsEqual(left = [], right = []) {
      return areComparableAssetItemListsEqual(left, right, normalizeHiddenHoldingsState);
    }

    function areUiPreferencesEqual(left = {}, right = {}) {
      return (
        areVisibleSectionListsEqual(left?.visibleSections || [], right?.visibleSections || []) &&
        areLivePricePreferencesEqual(left?.livePrice || {}, right?.livePrice || {}) &&
        areTradeQuickAssetsEqual(left?.tradeQuickAssets || [], right?.tradeQuickAssets || []) &&
        areHiddenHoldingsEqual(left?.hiddenHoldings || [], right?.hiddenHoldings || [])
      );
    }

    function bindSettingsSection(section) {
      if (!section || section.dataset.bound === "true") {
        return;
      }

      section.addEventListener("change", (event) => {
        const target = event.target instanceof global.Element ? event.target : null;
        if (!target) {
          return;
        }

        const toggle = target.closest("[data-settings-section-toggle]");
        if (toggle) {
          const currentUiPreferences = getCurrentUiPreferences?.() || {};
          const sectionId = String(toggle.dataset.settingsSectionToggle || "").trim();
          const nextVisible = new Set(getVisibleSectionIds());
          if (toggle.checked) {
            nextVisible.add(sectionId);
          } else {
            nextVisible.delete(sectionId);
          }

          queueUiPreferencesMutation(
            {
              ...currentUiPreferences,
              visibleSections: [...nextVisible],
            },
            "세팅을 저장했습니다.",
            {
              rerenderSettings: false,
            }
          );
          return;
        }

        const livePriceToggle = target.closest("[data-settings-live-price-toggle]");
        if (!livePriceToggle) {
          return;
        }

        const currentUiPreferences = getCurrentUiPreferences?.() || {};
        queueUiPreferencesMutation(
          {
            ...currentUiPreferences,
            livePrice: {
              ...getLivePricePreferences(),
              showGlobalIndices: livePriceToggle.checked,
            },
          },
          "세팅을 저장했습니다.",
          {
            rerenderSettings: false,
          }
        );
      });

      section.addEventListener("click", (event) => {
        const target = event.target instanceof global.Element ? event.target : null;
        if (!target) {
          return;
        }

        const initialSetupButton = target.closest("[data-settings-open-initial-setup]");
        if (initialSetupButton) {
          openGuideDestination("initial-setup-section");
          return;
        }

        const restoreHoldingButton = target.closest("[data-holding-restore-market]");
        if (restoreHoldingButton) {
          const holdingTarget = {
            market: restoreHoldingButton.dataset.holdingRestoreMarket || "",
            symbol: restoreHoldingButton.dataset.holdingRestoreSymbol || "",
            asset: restoreHoldingButton.dataset.holdingRestoreAsset || "",
          };

          const displayName = getDisplayAssetName({
            asset: holdingTarget.asset,
            symbol: holdingTarget.symbol,
            market: holdingTarget.market,
          });

          restoreHoldingPosition(holdingTarget)
            .then(() => {
              showAppToast(`${displayName} 보유 카드를 다시 표시합니다.`, "success", {
                title: "보유 다시 보기",
              });
            })
            .catch((error) => {
              showAppToast(error.message || "보유 종목을 다시 표시하지 못했습니다.", "error", {
                title: "복원 실패",
              });
            });
          return;
        }

        const resetButton = target.closest("#settings-reset");
        if (!resetButton) {
          return;
        }

        const currentUiPreferences = getCurrentUiPreferences?.() || {};
        const defaultVisibleSections = getDefaultVisibleSectionIds();
        if (
          areUiPreferencesEqual(
            {
              ...currentUiPreferences,
              visibleSections: defaultVisibleSections,
              livePrice: DEFAULT_LIVE_PRICE_PREFERENCES,
            },
            currentUiPreferences
          ) &&
          !getPendingUiPreferencesMutation?.() &&
          !getUiPreferencesSavePromise?.()
        ) {
          setSettingsStatus("이미 기본 구성입니다.", "neutral");
          return;
        }

        queueUiPreferencesMutation(
          {
            ...currentUiPreferences,
            visibleSections: defaultVisibleSections,
            livePrice: DEFAULT_LIVE_PRICE_PREFERENCES,
          },
          "기본 구성으로 되돌렸습니다."
        );
      });

      section.dataset.bound = "true";
    }

    return Object.freeze({
      getVisibleSectionIds,
      getLivePricePreferences,
      getTradeQuickAssets,
      getHiddenHoldings,
      shouldShowGlobalIndices,
      isSectionVisible,
      renderMobileSectionHub,
      renderSettingsSection,
      applySectionVisibility,
      areVisibleSectionListsEqual,
      areLivePricePreferencesEqual,
      areTradeQuickAssetsEqual,
      areUiPreferencesEqual,
      bindSettingsSection,
    });
  }

  global.AssetSettingsPanel = Object.freeze({
    createSettingsPanelHelpers,
  });
})(window);
