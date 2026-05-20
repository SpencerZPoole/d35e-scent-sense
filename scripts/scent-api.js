(() => {
  "use strict";

  function createApi({
    canTrackByScent,
    constants,
    evaluateScentDetection,
    evaluateScentState,
    getContextApi,
    getEffectiveScentRange,
    getScentContext,
    getScentRange,
    getScentRules,
    getScentStateApi,
    getTrackingByScentDc,
    hasScent,
    isOverlayVisible,
    openContextManager,
    refresh,
    resetNotificationState,
    scan,
    setOverlayVisible,
    setScentContextFlags,
    syncActorTokens,
  } = {}) {
    return {
      constants,
      context: getContextApi(),
      rules: getScentRules(),
      state: getScentStateApi(),
      canTrackByScent,
      evaluateScentDetection,
      evaluateScentState,
      getEffectiveScentRange,
      getScentContext,
      getScentRange,
      getTrackingByScentDc,
      hasScent,
      isOverlayVisible,
      openContextManager,
      refresh,
      resetNotificationState,
      scan,
      setScentContextFlags,
      setOverlayVisible,
      syncActorTokens,
    };
  }

  globalThis.d35eScentSenseApi = Object.freeze({
    create: createApi,
  });
})();
