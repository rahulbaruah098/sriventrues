// Make the first paint black only for a new public browsing session.
(function () {
  if (
    /^\/admin(?:\/|$)/.test(location.pathname) ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return;
  try {
    if (
      sessionStorage.getItem("sri-introduced") ||
      performance.getEntriesByType("navigation")[0]?.type === "back_forward"
    )
      return;
    sessionStorage.setItem("sri-introduced", "1");
    window.sriOpeningAt = performance.now();
    document.documentElement.classList.add("sri-opening");
    setTimeout(
      () => document.documentElement.classList.remove("sri-opening"),
      3850,
    );
  } catch {
    /* Storage-restricted browsing goes straight to the page. */
  }
})();
