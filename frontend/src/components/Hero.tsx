export function Hero() {
  return (
    <section className="text-center mb-8 sm:mb-10 animate-fade-in">
      <h1
        className="text-[34px] sm:text-[44px] font-medium leading-[1.08] tracking-[-0.02em] mb-4"
        style={{ color: "var(--ink-primary)" }}
      >
        Pluck a link.
        <br />
        Get the file. Done.
      </h1>
      <p
        className="text-[15px] leading-relaxed mb-1.5 px-4"
        style={{ color: "var(--ink-secondary)" }}
      >
        No ads. No sign-up. No watermarks. Just the download.
      </p>
      <p
        className="font-serif italic text-sm px-4"
        style={{ color: "var(--ink-tertiary)" }}
      >
        /plʌk/&nbsp;&nbsp;·&nbsp;&nbsp;verb&nbsp;&nbsp;·&nbsp;&nbsp;to take quickly and cleanly&nbsp;&nbsp;·&nbsp;&nbsp;also us
      </p>
    </section>
  );
}
