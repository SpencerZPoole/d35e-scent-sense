(() => {
  "use strict";

  function createApi({
    canTrackByScent,
    constants,
    evaluateScentDetection,
    evaluateScentState,
    getContextApi,
    getEffectiveScentRange,
    getOdorProfile,
    getOdorProfileApi,
    getScentContext,
    getScentRange,
    getScentRules,
    getScentStateApi,
    getTrackingByScentDc,
    hasScent,
    identifyFamiliarOdor,
    isOverlayVisible,
    openContextManager,
    refresh,
    resetNotificationState,
    scan,
    setOdorProfileFlags,
    setOverlayVisible,
    setScentContextFlags,
    syncActorTokens,
  } = {}) {
    return {
      constants,
      context: getContextApi(),
      odorProfile: getOdorProfileApi(),
      rules: getScentRules(),
      state: getScentStateApi(),
      canTrackByScent,
      evaluateScentDetection,
      evaluateScentState,
      getEffectiveScentRange,
      getOdorProfile,
      getScentContext,
      getScentRange,
      getTrackingByScentDc,
      hasScent,
      identifyFamiliarOdor,
      isOverlayVisible,
      openContextManager,
      refresh,
      resetNotificationState,
      scan,
      setOdorProfileFlags,
      setScentContextFlags,
      setOverlayVisible,
      syncActorTokens,
    };
  }

  globalThis.d35eScentSenseApi = Object.freeze({
    create: createApi,
  });
})();
