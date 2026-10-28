"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Schwarzer Sternenhimmel hinter allen Seiten. Performance: die Sterne werden einmal gezeichnet,
 * Parallaxe per CSS-Transform; nur wenige helle Sterne funkeln per CSS-Animation (kein Neuzeichnen pro Frame).
 */
export function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [bright, setBright] = useState<{ x: number; y: number; d: number; s: number }[]>([]);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight * 1.6;
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // ponytail: Dichte fest (ein Stern je ~1.800 px²), reicht für Laptop und Beamer.
      const n = Math.round((w * h) / 1800);
      for (let i = 0; i < n; i++) {
        ctx.globalAlpha = 0.15 + Math.random() * 0.55;
        ctx.fillStyle = "#cfd8e6";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 0.25 + Math.random() * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      setBright(Array.from({ length: 28 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, d: Math.random() * 6, s: 1.2 + Math.random() * 1.4 })));
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const h = window.innerHeight * 0.6;
        c.style.transform = `translate3d(0, ${-((window.scrollY * 0.04) % h)}px, 0)`;
      });
    };

    paint();
    window.addEventListener("resize", paint);
    if (!reduced) window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", paint);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
      <canvas ref={ref} className="absolute left-0 top-0 w-full will-change-transform" />
      {bright.map((b, i) => (
        <span
          key={i}
          className="twinkle absolute rounded-full bg-[#eef4ff]"
          style={{ left: `${b.x}%`, top: `${b.y}%`, width: b.s, height: b.s, animationDelay: `${b.d}s`, boxShadow: "0 0 6px 1px rgba(220,232,255,0.35)" }}
        />
      ))}
    </div>
  );
}
