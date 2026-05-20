(() => {
  "use strict";

  function createApi({
    canTrackByScent,
    constants,
    evaluateScentDetection,
    getContextApi,
    getEffectiveScentRange,
    getScentContext,
    getScentRange,
    getScentRules,
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
      canTrackByScent,
      evaluateScentDetection,
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
