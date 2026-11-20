/* Dynamic favicon: loads public revision; refreshes after admin publishing. */
const base = '/api/public/favicon';
const ensure = (rel, size) => {
  let el = document.querySelector(`link[data-sri-favicon="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.dataset.sriFavicon = rel;
    el.rel = rel;
    el.type = 'image/png';
    if (size) el.sizes = `${size}x${size}`;
    document.head.appendChild(el);
  }
  return el;
};
export async function refreshFavicon() {
  try {
    const response = await fetch(base, { cache: 'no-store' });
    if (!response.ok) throw new Error('favicon service unavailable');
    const result = await response.json();
    const revision = result.custom ? result.revision : 'default';
    ensure('icon', 32).href = `${base}/32.png?v=${encodeURIComponent(revision)}`;
    ensure('apple-touch-icon', 180).href = `${base}/180.png?v=${encodeURIComponent(revision)}`;
  } catch {
    // Fallback remains available even when the backend is offline.
    ensure('icon', 32).href = '/favicon.png';
    ensure('apple-touch-icon', 180).href = '/favicon.png';
  }
}
if (typeof document !== 'undefined') {
  refreshFavicon();
  window.addEventListener('sri:favicon-updated', refreshFavicon);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshFavicon(); });
}
