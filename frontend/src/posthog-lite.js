export function initPostHogLite() {
  const key = process.env.REACT_APP_POSTHOG_KEY;
  const host = process.env.REACT_APP_POSTHOG_HOST || "https://app.posthog.com";
  if (!key || window.posthog) return;
  window.posthog = {
    capture: (event, properties = {}) => {
      try {
        navigator.sendBeacon(
          `${host.replace(/\/$/, "")}/capture/`,
          new Blob([JSON.stringify({ api_key: key, event, distinct_id: localStorage.getItem("filthy_user_id") || "anonymous", properties })], { type: "application/json" })
        );
      } catch {
        // Analytics should never interrupt the app.
      }
    },
  };
  window.posthog.capture("$pageview", { path: window.location.pathname });
}
