export function trackOnboarding(event, properties = {}) {
  const payload = {
    event,
    properties: {
      path: window.location.pathname,
      ts: new Date().toISOString(),
      ...properties,
    },
  };
  try {
    window.posthog?.capture?.(event, payload.properties);
  } catch {
    // Tracking should never block the first action.
  }
  try {
    const key = "fiilthy_onboarding_events";
    const rows = JSON.parse(localStorage.getItem(key) || "[]");
    rows.push(payload);
    localStorage.setItem(key, JSON.stringify(rows.slice(-100)));
  } catch {
    // Ignore storage failures.
  }
}

export function startStepTimer(step) {
  const startedAt = Date.now();
  trackOnboarding("onboarding_step_viewed", { step });
  const hesitation = window.setTimeout(() => {
    trackOnboarding("onboarding_hesitation", { step, idle_seconds: 60 });
  }, 60000);

  return () => {
    window.clearTimeout(hesitation);
    trackOnboarding("onboarding_step_left", {
      step,
      seconds_spent: Math.round((Date.now() - startedAt) / 1000),
    });
  };
}
