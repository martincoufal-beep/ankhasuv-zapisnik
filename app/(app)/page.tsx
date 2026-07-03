import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ItemWithRelations, MediaType } from "@/lib/types";
import { STAV_VIEWS } from "@/lib/types";
import { StarDisplay } from "@/components/StarRating";
import ItemCard from "@/components/ItemCard";
import { Icon, TypeIcon } from "@/components/icons";

const MONTHS = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];

function StatCard({
  icon,
  iconColor,
  label,
  value,
  sub,
  trend,
  children,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: string;
  sub?: string;
  trend?: { up: boolean; text: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in srgb, ${iconColor} 16%, transparent)`,
            color: iconColor,
          }}
        >
          <Icon name={icon} size={16} />
        </span>
        <p className="text-xs font-medium text-muted">{label}</p>
      </div>
      <p className="mt-2.5 text-3xl font-bold tracking-tight">{value}</p>
      {children}
      {trend ? (
        <p
          className={`mt-1 text-[11px] font-medium ${trend.up ? "text-green" : "text-red"}`}
        >
          {trend.up ? "↑" : "↓"} {trend.text}
        </p>
      ) : (
        sub && <p className="mt-1 text-[11px] text-muted/80">{sub}</p>
      )}
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: itemsData }, { data: typesData }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "*, media_type:media_types(*), status:statuses(*), images(*), item_platforms(platform:platforms(name))"
      )
      .order("created_at", { ascending: false }),
    supabase.from("media_types").select("*").order("sort"),
  ]);

  const items = (itemsData ?? []) as ItemWithRelations[];
  const mediaTypes = (typesData ?? []) as MediaType[];
  const year = new Date().getFullYear();

  const doneMeanings = new Set(STAV_VIEWS.dokonceno.meanings);
  const progressMeanings = new Set(STAV_VIEWS.rozpracovano.meanings);
  const backlogMeanings = new Set(STAV_VIEWS.backlog.meanings);

  const completedIn = (y: number) =>
    items.filter(
      (i) =>
        i.status &&
        doneMeanings.has(i.status.meaning) &&
        i.end_date?.startsWith(String(y))
    );
  const completedThisYear = completedIn(year);
  const completedLastYear = completedIn(year - 1);
  const trend =
    completedLastYear.length > 0
      ? {
          up: completedThisYear.length >= completedLastYear.length,
          text: `${Math.abs(
            Math.round(
              ((completedThisYear.length - completedLastYear.length) /
                completedLastYear.length) *
                100
            )
          )} % vs loni`,
        }
      : undefined;

  const inProgress = items.filter(
    (i) => i.status && progressMeanings.has(i.status.meaning)
  );
  const backlog = items.filter(
    (i) => i.status && backlogMeanings.has(i.status.meaning)
  );
  const rated = items.filter((i) => i.rating !== null);
  const avgRating =
    rated.length > 0
      ? rated.reduce((sum, i) => sum + (i.rating ?? 0), 0) / rated.length
      : null;

  const doneByType = new Map<string, number>();
  for (const i of completedThisYear) {
    const name = i.media_type?.name ?? "?";
    doneByType.set(name, (doneByType.get(name) ?? 0) + 1);
  }
  const doneBreakdown = [...doneByType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, n]) => `${n}× ${name.toLowerCase()}`)
    .join(" · ");

  // Aktivita: zelená = dokončeno (end_date), modrá = rozehráno/rozečteno (start_date)
  const doneByMonth = Array.from({ length: 12 }, () => 0);
  const startedByMonth = Array.from({ length: 12 }, () => 0);
  for (const i of items) {
    if (
      i.status &&
      doneMeanings.has(i.status.meaning) &&
      i.end_date?.startsWith(String(year))
    ) {
      doneByMonth[Number(i.end_date.slice(5, 7)) - 1]++;
    }
    if (
      i.status &&
      progressMeanings.has(i.status.meaning) &&
      i.start_date?.startsWith(String(year))
    ) {
      startedByMonth[Number(i.start_date.slice(5, 7)) - 1]++;
    }
  }
  const activityMax = Math.max(
    ...doneByMonth.map((n, i) => n + startedByMonth[i]),
    1
  );
  const hasActivity = doneByMonth.some((n, i) => n + startedByMonth[i] > 0);

  const byType = new Map<string, { name: string; color: string; slug: string; n: number }>();
  for (const i of items) {
    const t = i.media_type;
    if (!t) continue;
    const entry =
      byType.get(t.id) ?? { name: t.name, color: t.color, slug: t.slug, n: 0 };
    entry.n++;
    byType.set(t.id, entry);
  }
  const typeShares = [...byType.values()].sort((a, b) => b.n - a.n);
  const top = typeShares.slice(0, 5);
  const restCount = typeShares.slice(5).reduce((s, t) => s + t.n, 0);
  const donutParts = [
    ...top,
    ...(restCount > 0
      ? [{ name: "Ostatní", color: "#5a5d6b", slug: "ostatni", n: restCount }]
      : []),
  ];
  let acc = 0;
  const donutStops = donutParts
    .map((p) => {
      const from = (acc / Math.max(items.length, 1)) * 100;
      acc += p.n;
      const to = (acc / Math.max(items.length, 1)) * 100;
      return `${p.color} ${from}% ${to}%`;
    })
    .join(", ");

  const recent = items.slice(0, 8);

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Moje knihovna</h1>
      <p className="mt-1 text-sm text-muted">
        {items.length === 0
          ? "Zápisník čeká na první příběh."
          : `${items.length} příběhů v zápisníku`}
      </p>

      {items.length === 0 ? (
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="text-2xl font-bold tracking-tight">
            Zápisník je zatím prázdný.
          </p>
          <p className="mt-3 leading-relaxed text-muted">
            Který příběh do něj zapíšeš první? Rozehraná hra, rozečtená kniha
            i film, na který se teprve chystáš — všechno sem patří.
          </p>
          <Link
            href="/pridat"
            className="btn-accent mt-6 inline-block rounded-lg px-5 py-2.5"
          >
            Zapsat první položku
          </Link>
        </div>
      ) : (
        <>
          {/* Pill chips typů */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/knihovna"
              className="btn-accent flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm"
            >
              Vše
              <span className="rounded-full bg-black/20 px-1.5 text-xs tabular-nums">
                {items.length}
              </span>
            </Link>
            {mediaTypes
              .filter((t) => byType.has(t.id))
              .map((t) => (
                <Link
                  key={t.id}
                  href={`/knihovna?typ=${t.slug}`}
                  className="transition-quick flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
                >
                  <TypeIcon slug={t.slug} size={14} />
                  {t.name}
                </Link>
              ))}
          </div>

          {/* Přehledové karty */}
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatCard
              icon="trophy"
              iconColor="#4ADE80"
              label="Letos dokončeno"
              value={String(completedThisYear.length)}
              trend={trend}
              sub={doneBreakdown || `v roce ${year}`}
            />
            <StatCard
              icon="clock"
              iconColor="#60A5FA"
              label="Rozpracováno"
              value={String(inProgress.length)}
              sub={doneBreakdown && trend ? doneBreakdown : "právě prožívané příběhy"}
            />
            <StatCard
              icon="star"
              iconColor="#F0A33C"
              label="Průměrné hodnocení"
              value={
                avgRating !== null
                  ? (avgRating / 2).toLocaleString("cs-CZ", {
                      maximumFractionDigits: 1,
                    })
                  : "—"
              }
            >
              {avgRating !== null && (
                <div className="mt-1.5">
                  <StarDisplay value={Math.round(avgRating)} size={13} />
                </div>
              )}
            </StatCard>
            <StatCard
              icon="box"
              iconColor="#FB923C"
              label="Backlog"
              value={String(backlog.length)}
              sub="je se na co těšit"
            />
          </div>

          {/* Nedávno přidané */}
          <div className="mt-8 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold tracking-tight">Nedávno přidané</h2>
            <Link
              href="/knihovna"
              className="transition-quick text-sm font-medium text-muted hover:text-brass"
            >
              Zobrazit vše →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {recent.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>

          {/* Grafy */}
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Aktivita v roce {year}
                </h2>
                <span className="flex items-center gap-3 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green" aria-hidden />
                    Dokončeno
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue" aria-hidden />
                    Rozehráno
                  </span>
                </span>
              </div>
              {hasActivity ? (
                <div className="mt-5 flex h-36 items-end gap-1.5">
                  {doneByMonth.map((done, i) => {
                    const started = startedByMonth[i];
                    return (
                      <div
                        key={i}
                        className="flex flex-1 flex-col items-center gap-1.5"
                        title={`${MONTHS[i]}: ${done} dokončeno, ${started} rozehráno`}
                      >
                        <div className="flex w-full flex-col justify-end" style={{ height: 96 }}>
                          <div
                            className="w-full rounded-t-sm bg-blue/90"
                            style={{ height: `${(started / activityMax) * 96}px` }}
                          />
                          <div
                            className={`w-full bg-green/90 ${started === 0 ? "rounded-t-sm" : ""}`}
                            style={{ height: `${(done / activityMax) * 96}px` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted/70">{MONTHS[i]}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  Letos zatím nic dokončeného — až něco dočteš, dohraješ nebo
                  dokoukáš, vykreslí se to tady.
                </p>
              )}
            </div>

            <div className="rounded-xl border border-line bg-card p-5">
              <h2 className="text-base font-bold tracking-tight">Oblíbené typy</h2>
              <div className="mt-5 flex items-center gap-6">
                <div
                  className="relative h-32 w-32 shrink-0 rounded-full"
                  style={{ background: `conic-gradient(${donutStops})` }}
                  role="img"
                  aria-label="Podíl typů médií v knihovně"
                >
                  <div className="absolute inset-[20%] flex flex-col items-center justify-center rounded-full bg-card">
                    <span className="text-lg font-bold tracking-tight">
                      {Math.round((donutParts[0].n / items.length) * 100)} %
                    </span>
                    <span className="max-w-full truncate px-1 text-[10px] font-medium text-muted">
                      {donutParts[0].name}
                    </span>
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-2 text-sm">
                  {donutParts.map((p) => (
                    <li key={p.name} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: p.color }}
                        aria-hidden
                      />
                      <span className="truncate font-medium text-muted">{p.name}</span>
                      <span className="ml-auto tabular-nums text-muted/70">
                        {Math.round((p.n / items.length) * 100)} %
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
