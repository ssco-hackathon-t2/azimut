import { asset } from "@/lib/data";

export interface HeroData {
  titel: string;
  weiter: string;
  /** Standbild vom Start (Spectrum Flug 2, Livestream-Frame T+10 s, ohne Einblendungen zugeschnitten). */
  bild: string;
  bild_alt: string;
  credit: string;
  weiter_nach_s: number;
}

/** Hero (Artboard 0): ein Satz groß über dem Start von Spectrum, „Scroll down“ erscheint erst nach einer Weile. */
export function ProduktionHero({ d }: { d: HeroData }) {
  return (
    <section id="start" aria-labelledby="hero-titel" className="relative isolate h-[calc(100svh-var(--header-h))] min-h-[600px] overflow-hidden bg-[#070c16]">
      {/* eslint-disable-next-line @next/next/no-img-element -- statischer Export ohne Bildoptimierung */}
      <img src={asset(d.bild)} alt={d.bild_alt} className="drift absolute inset-0 h-full w-full object-cover [filter:brightness(0.75)]" />
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,12,22,0.92)_0%,rgba(7,12,22,0.35)_45%,rgba(7,12,22,0.55)_100%)]" />
      <div className="absolute inset-x-4 bottom-[150px] sm:inset-x-12">
        <h1 id="hero-titel" className="max-w-[1100px] font-display text-[clamp(3rem,6.6vw,95px)] font-extrabold leading-[0.95] tracking-[-0.035em]">
          {d.titel}
        </h1>
      </div>
      <a href="#einstieg" className="later absolute bottom-7 left-1/2 flex min-h-11 min-w-11 -translate-x-1/2 flex-col items-center gap-1 text-[15px] no-underline" style={{ animationDelay: `${d.weiter_nach_s}s` }}>
        <span>{d.weiter}</span>
        <svg className="bob" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" style={{ animationDelay: `${d.weiter_nach_s + 0.8}s` }}>
          <path d="M6 10 L14 18 L22 10" fill="none" stroke="#8fd3ff" strokeWidth="2.5" />
        </svg>
      </a>
      <p className="absolute bottom-2.5 right-4 text-[0.7rem] text-mist sm:right-8">{d.credit}</p>
    </section>
  );
}
