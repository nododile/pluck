export function Footer() {
  return (
    <footer
      className="mt-20 pt-8 pb-12 text-center text-xs"
      style={{
        color: "var(--ink-tertiary)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <p className="font-serif italic mb-2 text-sm" style={{ color: "var(--ink-secondary)" }}>
        Made with care · no ads, no tracking, no nonsense
      </p>
      <p>
        Pluck respects copyright. You&apos;re responsible for what you download.
      </p>
    </footer>
  );
}
