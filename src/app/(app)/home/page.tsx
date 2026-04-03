import Link from "next/link";

const HOME_PANELS = [
  { id: "stock", label: "Stock" },
  { id: "cook", label: "Cook" },
  { id: "plan", label: "Plan" },
] as const;

type HomePanel = (typeof HOME_PANELS)[number]["id"];

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function parsePanel(raw?: string): HomePanel {
  return HOME_PANELS.some((panel) => panel.id === raw) ? (raw as HomePanel) : "stock";
}

function buildHomeHref(panel: HomePanel) {
  return panel === "stock" ? "/home" : `/home?panel=${panel}`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ panel?: string }>;
}) {
  const sp = await searchParams;
  const activePanel = parsePanel(sp.panel);

  return (
    <div className="flex min-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-7rem)] flex-col justify-center gap-10">
      <header className="text-center">
        <p className="text-sm text-[var(--muted)]">{formatDate(new Date())}</p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight md:text-4xl">Home</h1>
      </header>

      <Link
        href="/scan"
        className="btn-primary-touch flex w-full items-center justify-center rounded-2xl bg-[var(--accent)] py-5 text-lg font-semibold text-white shadow-[0_0_32px_var(--accent-glow)] active:scale-[0.98] active:opacity-90 transition-transform"
      >
        Scan item
      </Link>

      <div className="panel-switcher" role="tablist" aria-label="Home sections">
        {HOME_PANELS.map((panel) => {
          const active = activePanel === panel.id;
          return (
            <Link
              key={panel.id}
              href={buildHomeHref(panel.id)}
              className={`panel-switcher__tab ${active ? "panel-switcher__tab--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {panel.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
