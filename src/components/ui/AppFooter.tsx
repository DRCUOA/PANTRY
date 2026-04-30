/**
 * Tiny copyright + build-number strip shown at the bottom of every view.
 *
 * Sits in normal document flow so it's pushed below the page content but
 * above the fixed TabBar (the app shell reserves bottom padding for the
 * tab bar — the footer floats just above that gap on app pages).
 */

const COPYRIGHT_HOLDER = "nzwebapps";
const COPYRIGHT_YEAR = 2026;
const APP_VERSION = "0.3.28";

export function AppFooter({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`mx-auto w-full max-w-2xl px-4 py-3 text-center text-[0.7rem] leading-tight text-[var(--muted)] md:max-w-3xl md:px-6 ${className}`}
      aria-label="Site footer"
    >
      <span>
        © {COPYRIGHT_HOLDER} {COPYRIGHT_YEAR}
      </span>
      <span aria-hidden="true" className="mx-1.5 opacity-60">
        ·
      </span>
      <span title="Build number" className="font-mono tracking-tight">
        v{APP_VERSION}
      </span>
    </footer>
  );
}
