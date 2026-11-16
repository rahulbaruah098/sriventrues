import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export function Splash({ finish }) {
  useEffect(() => {
    document.documentElement.classList.remove("sri-opening");
    const elapsed = performance.now() - window.sriOpeningAt;
    const timer = setTimeout(finish, Math.max(0, 3500 - elapsed));
    const stop = () => finish();
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    media.addEventListener("change", stop);
    return () => {
      clearTimeout(timer);
      media.removeEventListener("change", stop);
    };
  }, [finish]);
  return (
    <div
      className="splash"
      role="img"
      aria-label="SRI Ventures & Consulting Pvt. Ltd."
    >
      <img src="/signature.svg" alt="" width="1000" height="140" />
      <button onClick={finish} className="skip-intro">
        Skip introduction
      </button>
    </div>
  );
}

export function ScrollMotion({ active, root }) {
  const { pathname } = useLocation();
  useEffect(() => {
    if (
      !active ||
      !root.current ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let alive = true,
      frame = 0,
      cleanup = () => {};
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    Promise.all([import("gsap"), import("gsap/ScrollTrigger")])
      .then(([{ gsap }, { ScrollTrigger }]) => {
        if (!alive || query.matches) return;
        gsap.registerPlugin(ScrollTrigger);
        const scope = root.current,
          seen = new WeakSet();
        const context = gsap.context(() => {}, scope);
        function register() {
          if (!alive) return;
          context.add(() => {
            for (const el of scope.querySelectorAll(
              "[data-reveal], [data-mask], [data-parallax], [data-progress]",
            )) {
              if (seen.has(el)) continue;
              seen.add(el);
              if (el.hasAttribute("data-progress")) {
                gsap.fromTo(
                  el,
                  { scaleY: 0 },
                  {
                    scaleY: 1,
                    transformOrigin: "top",
                    ease: "none",
                    scrollTrigger: {
                      trigger: el.parentNode,
                      start: "top 65%",
                      end: "bottom 65%",
                      scrub: true,
                    },
                  },
                );
              } else if (el.hasAttribute("data-parallax")) {
                if (innerWidth >= 900)
                  gsap.fromTo(
                    el,
                    { yPercent: -2 },
                    {
                      yPercent: 2,
                      ease: "none",
                      scrollTrigger: {
                        trigger: el.parentNode,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: true,
                      },
                    },
                  );
              } else {
                // Start only on entry. Offscreen content stays available even if the motion module fails.
                ScrollTrigger.create({
                  trigger: el,
                  start: "top 97%",
                  once: true,
                  onEnter: () => {
                    const from = el.hasAttribute("data-mask")
                      ? { clipPath: "inset(0 0 9% 0)" }
                      : { y: 17, opacity: 0.72 };
                    if (alive)
                      gsap.fromTo(el, from, {
                        y: 0,
                        opacity: 1,
                        clipPath: "inset(0% 0% 0% 0%)",
                        duration: 0.68,
                        ease: "power2.out",
                        clearProps: "transform,opacity,clipPath",
                      });
                  },
                });
              }
            }
          });
          ScrollTrigger.refresh();
        }
        register();
        const observer = new MutationObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(register);
        });
        observer.observe(scope, { subtree: true, childList: true });
        cleanup = () => {
          observer.disconnect();
          cancelAnimationFrame(frame);
          context.revert();
        };
      })
      .catch(() => {
        /* The document is fully visible with native scrolling. */
      });
    const reduce = () => {
      if (query.matches) {
        alive = false;
        cleanup();
      }
    };
    query.addEventListener("change", reduce);
    return () => {
      alive = false;
      cleanup();
      query.removeEventListener("change", reduce);
    };
  }, [active, pathname, root]);
  return null;
}
