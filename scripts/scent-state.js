(() => {
  "use strict";

  const DETECTION_STATES = Object.freeze({
    NONE: "none",
    PRESENCE: "presence",
    DIRECTION_AVAILABLE: "directionAvailable",
    DIRECTION_REQUESTED: "directionRequested",
    DIRECTION_REVEALED: "directionRevealed",
    PINPOINT: "pinpoint",
  });

  const DIRECTION_STATUSES = Object.freeze({
    NONE: "none",
    REQUESTED: "requested",
    REVEALED: "revealed",
  });

  const RANGE_BANDS = Object.freeze({
    PRESENCE: "presence",
    PINPOINT: "pinpoint",
  });

  function normalizeToken(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  }

  function normalizeDirectionStatus(value) {
    const token = normalizeToken(value);
    if (token === "directionrequested" || token === "requested" || token === "request") return DIRECTION_STATUSES.REQUESTED;
    if (token === "directionrevealed" || token === "revealed" || token === "reveal") return DIRECTION_STATUSES.REVEALED;
    return DIRECTION_STATUSES.NONE;
  }

  function normalizeReasons(detection = {}, detectable = false) {
    if (Array.isArray(detection.reasons)) return detection.reasons.slice();
    if (!detectable && detection.reason) return [detection.reason];
    return [];
  }

  function normalizeDetection(detection = {}) {
    const detectable = detection.detectable === true;
    const pinpoint = detectable && detection.pinpoint === true;
    const band = detectable ? pinpoint ? RANGE_BANDS.PINPOINT : RANGE_BANDS.PRESENCE : null;
    const reasons = normalizeReasons(detection, detectable);

    return {
      ...detection,
      detectable,
      pinpoint,
      band,
      reason: detection.reason ?? (detectable ? "detectable" : reasons[0] ?? "not-detectable"),
      reasons,
    };
  }

  function evaluateScentState({
    detection = {},
    directionAvailable = true,
    directionStatus = DIRECTION_STATUSES.NONE,
  } = {}) {
    const normalizedDetection = normalizeDetection(detection);
    const normalizedDirectionStatus = normalizeDirectionStatus(directionStatus);
    const states = [];

    if (!normalizedDetection.detectable) {
      return {
        ...normalizedDetection,
        detection: normalizedDetection,
        state: DETECTION_STATES.NONE,
        states,
        presence: false,
        directionAvailable: false,
        directionRequested: false,
        directionRevealed: false,
        directionStatus: DIRECTION_STATUSES.NONE,
        requiresGmDirection: false,
        notificationBand: null,
      };
    }

    states.push(DETECTION_STATES.PRESENCE);

    if (normalizedDetection.pinpoint) {
      states.push(DETECTION_STATES.PINPOINT);
      return {
        ...normalizedDetection,
        detection: normalizedDetection,
        state: DETECTION_STATES.PINPOINT,
        states,
        presence: true,
        directionAvailable: false,
        directionRequested: false,
        directionRevealed: false,
        directionStatus: DIRECTION_STATUSES.NONE,
        requiresGmDirection: false,
        notificationBand: RANGE_BANDS.PINPOINT,
      };
    }

    const canRequestDirection = directionAvailable !== false;
    const directionRevealed = canRequestDirection && normalizedDirectionStatus === DIRECTION_STATUSES.REVEALED;
    const directionRequested = canRequestDirection && (directionRevealed || normalizedDirectionStatus === DIRECTION_STATUSES.REQUESTED);

    if (canRequestDirection) states.push(DETECTION_STATES.DIRECTION_AVAILABLE);
    if (directionRequested) states.push(DETECTION_STATES.DIRECTION_REQUESTED);
    if (directionRevealed) states.push(DETECTION_STATES.DIRECTION_REVEALED);

    let state = canRequestDirection ? DETECTION_STATES.DIRECTION_AVAILABLE : DETECTION_STATES.PRESENCE;
    if (directionRequested) state = DETECTION_STATES.DIRECTION_REQUESTED;
    if (directionRevealed) state = DETECTION_STATES.DIRECTION_REVEALED;

    return {
      ...normalizedDetection,
      detection: normalizedDetection,
      state,
      states,
      presence: true,
      directionAvailable: canRequestDirection,
      directionRequested,
      directionRevealed,
      directionStatus: directionRevealed
        ? DIRECTION_STATUSES.REVEALED
        : directionRequested
          ? DIRECTION_STATUSES.REQUESTED
          : DIRECTION_STATUSES.NONE,
      requiresGmDirection: directionRequested && !directionRevealed,
      notificationBand: RANGE_BANDS.PRESENCE,
    };
  }

  const api = Object.freeze({
    constants: Object.freeze({
      DETECTION_STATES,
      DIRECTION_STATUSES,
      RANGE_BANDS,
    }),
    evaluateScentState,
    normalizeDetection,
    normalizeDirectionStatus,
  });

  globalThis.d35eScentSenseState = api;
})();
