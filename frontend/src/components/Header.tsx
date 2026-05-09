import { IconArrowDown } from "./icons";

export function Header() {
  return (
    <header className="flex items-center justify-between px-5 sm:px-8 py-5 sm:py-6">
      <div className="flex items-baseline gap-2.5">
        <div
          className="self-center flex items-center justify-center rounded-lg w-7 h-7"
          style={{ background: "var(--ink-primary)", color: "var(--ink-on-primary)" }}
          aria-hidden="true"
        >
          <IconArrowDown width={18} height={18} strokeWidth={2} />
        </div>
        <span className="font-medium text-base">Pluck</span>
        <span
          className="font-serif italic text-[13px] hidden sm:inline"
          style={{ color: "var(--ink-tertiary)" }}
        >
          /plʌk/
        </span>
      </div>

      <nav className="flex items-center gap-6 text-sm" style={{ color: "var(--ink-secondary)" }}>
        <a href="#how-it-works" className="hover:opacity-70 transition-opacity">
          How it works
        </a>
        <a
          href="#supported"
          className="hover:opacity-70 transition-opacity hidden sm:inline"
        >
          Supported sites
        </a>
      </nav>
    </header>
  );
}
