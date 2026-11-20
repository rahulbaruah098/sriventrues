import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Presentation-only gate for the existing SRI Assistant. No message/knowledge logic changed. */
export default function SriAssistantVisibility({ children }) {
  const { pathname } = useLocation();
  const [visible, setVisible] = useState(false);
  const [greeting, setGreeting] = useState(false);
  const seenGreeting = useRef(false);
  const root = useRef(null);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    const onHome = pathname === '/' || pathname === '';
    setVisible(false);
    setGreeting(false);

    const update = () => {
      frame = 0;
      if (cancelled) return;
      const footer = document.querySelector('footer');
      // Hide as soon as footer content could be obscured by the floating launcher.
      const footerNear = Boolean(footer && footer.getBoundingClientRect().top < window.innerHeight - 44);
      let heroPassed = true;
      if (onHome) {
        const heading = document.querySelector('main h1');
        const hero = heading?.closest('section') ||
          document.querySelector('main .hero, main .home-hero, main [class*="hero-"]');
        // Fail closed during startup: don't show the assistant above the banner.
        heroPassed = hero
          ? hero.getBoundingClientRect().bottom <= 60
          : window.scrollY >= window.innerHeight;
      }
      setVisible(heroPassed && !footerNear);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // A lazy-loaded hero can change its height after the first paint.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.documentElement);
    return () => {
      cancelled = true;
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible) setGreeting(false);
    if (!visible || seenGreeting.current || pathname !== '/') return;
    seenGreeting.current = true;
    setGreeting(true);
    const id = window.setTimeout(() => setGreeting(false), 4200);
    return () => window.clearTimeout(id);
  }, [visible, pathname]);

  useEffect(() => {
    if (!visible) return;
    // Suppress the legacy multilingual launcher tooltip, not the actual chat window.
    const hideOldTooltip = () => {
      if (!root.current) return;
      for (const element of root.current.querySelectorAll('strong, span, p, small, div')) {
        if (element.textContent?.trim() !== 'Chat with SRI Assistant') continue;
        let ancestor = element.parentElement;
        for (let depth = 0; ancestor && depth < 3 && ancestor !== root.current; depth++, ancestor = ancestor.parentElement) {
          const classText = typeof ancestor.className === 'string' ? ancestor.className : '';
          if (/(tooltip|peek|nudge|prompt|teaser|bubble|callout|hint)/i.test(classText)) {
            ancestor.style.setProperty('display', 'none', 'important');
            break;
          }
        }
      }
    };
    hideOldTooltip();
    const observer = new MutationObserver(hideOldTooltip);
    observer.observe(root.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={root} className={`sri-v26-gate${visible ? '' : ' sri-v26-hidden'}`} onClickCapture={() => setGreeting(false)}>
      {children}
      {greeting && visible && (
        <div className="sri-v26-greeting" role="status" aria-live="polite">
          Hi! 👋 How can I help you?
        </div>
      )}
    </div>
  );
}
