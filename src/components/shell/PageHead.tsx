export function PageHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[88rem] px-4 pb-6 pt-12 sm:px-8 sm:pt-16">
      <h1 className="text-[clamp(2rem,4vw,3.1rem)] font-semibold leading-[1.08]">{title}</h1>
      {children && <div className="mt-4 max-w-[64ch] text-[1.05rem] text-mist">{children}</div>}
    </div>
  );
}

export function Section({ id, title, intro, children }: { id: string; title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="mx-auto max-w-[88rem] scroll-mt-28 px-4 pb-16 pt-10 sm:px-8">
      <div className="border-t border-rule pt-8">
        <h2 id={`${id}-h`} className="text-[1.55rem] font-semibold leading-tight">
          {title}
        </h2>
        {intro && <div className="mt-2 max-w-[68ch] text-mist">{intro}</div>}
        <div className="mt-7">{children}</div>
      </div>
    </section>
  );
}
