import { createClient } from "@/lib/supabase/server";
import type { ItemWithRelations, MediaType } from "@/lib/types";
import { STAV_VIEWS, MEANING_LABELS } from "@/lib/types";
import type { StatusMeaning } from "@/lib/types";
import { StarDisplay } from "@/components/StarRating";
import { TypeIcon } from "@/components/icons";

export const metadata = { title: "Statistiky" };

const MONTHS = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];

export default async function StatsPage() {
  const supabase = await createClient();
  const [{ data: itemsData }, { data: typesData }] = await Promise.all([
    supabase
      .from("items")
      .select("*, media_type:media_types(*), status:statuses(*)")
      .order("created_at", { ascending: false }),
    supabase.from("media_types").select("*").order("sort"),
  ]);
  const items = (itemsData ?? []) as ItemWithRelations[];
  const mediaTypes = (typesData ?? []) as MediaType[];
  const year = new Date().getFullYear();
  const doneMeanings = new Set(STAV_VIEWS.dokonceno.meanings);

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-screen-xl px-4 py-5 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight">Statistiky</h1>
        <p className="mx-auto mt-20 max-w-md text-center leading-relaxed text-muted">
          Statistiky se rozsvítí, jakmile do zápisníku přibudou první příběhy.
        </p>
      </main>
    );
  }

  // Přehled podle typů: počet, dokončeno, průměr hodnocení
  const perType = mediaTypes
    .map((t) => {
      const list = items.filter((i) => i.media_type_id === t.id);
      const rated = list.filter((i) => i.rating !== null);
      const avg =
        rated.length > 0
          ? rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length
          : null;
      const done = list.filter(
        (i) => i.status && doneMeanings.has(i.status.meaning)
      ).length;
      return { type: t, total: list.length, done, avg };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...perType.map((r) => r.total), 1);

  // Rozpad stavů (přes meaning)
  const meaningCounts = new Map<StatusMeaning, number>();
  for (const i of items) {
    if (!i.status) continue;
    meaningCounts.set(
      i.status.meaning,
      (meaningCounts.get(i.status.meaning) ?? 0) + 1
    );
  }
  const meaningRows = [...meaningCounts.entries()].sort((a, b) => b[1] - a[1]);
  const withStatus = [...meaningCounts.values()].reduce((s, n) => s + n, 0);

  // Aktivita za posledních 12 měsíců (dokončeno)
  const now = new Date();
  const months: { label: string; count: number }[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const count = items.filter(
      (i) =>
        i.status &&
        doneMeanings.has(i.status.meaning) &&
        i.end_date?.startsWith(key)
    ).length;
    months.push({ label: MONTHS[d.getMonth()], count });
  }
  const monthMax = Math.max(...months.map((m) => m.count), 1);

  const rated = items.filter((i) => i.rating !== null);
  const avgAll =
    rated.length > 0
      ? rated.reduce((s, i) => s + (i.rating ?? 0), 0) / rated.length
      : null;
  const completedThisYear = items.filter(
    (i) =>
      i.status &&
      doneMeanings.has(i.status.meaning) &&
      i.end_date?.startsWith(String(year))
  ).length;

  const statusColor = (m: StatusMeaning) =>
    items.find((i) => i.status?.meaning === m)?.status?.color ?? "#9CA3AF";

  return (
    <main className="mx-auto max-w-screen-xl px-4 py-5 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Statistiky</h1>
      <p className="mt-1 text-sm text-muted">
        Přehled celé knihovny — {items.length} položek
      </p>

      {/* Souhrn */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Celkem položek", value: String(items.length) },
          { label: `Dokončeno ${year}`, value: String(completedThisYear) },
          { label: "Ohodnoceno", value: String(rated.length) },
          {
            label: "Průměr hodnocení",
            value:
              avgAll !== null
                ? (avgAll / 2).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })
                : "—",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-line bg-card p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {/* Položky podle typu */}
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-base font-bold tracking-tight">Podle typu média</h2>
          <ul className="mt-4 space-y-3">
            {perType.map(({ type, total, done, avg }) => (
              <li key={type.id}>
                <div className="flex items-center gap-2 text-sm">
                  <span style={{ color: type.color }}>
                    <TypeIcon slug={type.slug} size={14} />
                  </span>
                  <span className="font-medium">{type.name}</span>
                  <span className="ml-auto flex items-center gap-3 text-xs text-muted">
                    {avg !== null && (
                      <span className="flex items-center gap-1">
                        <StarDisplay value={Math.round(avg)} size={10} />
                        {(avg / 2).toLocaleString("cs-CZ", {
                          maximumFractionDigits: 1,
                        })}
                      </span>
                    )}
                    <span className="tabular-nums">
                      {done}/{total}
                    </span>
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(total / maxTotal) * 100}%`,
                      backgroundColor: type.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Rozpad stavů */}
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="text-base font-bold tracking-tight">Podle stavu</h2>
          <ul className="mt-4 space-y-2.5">
            {meaningRows.map(([m, n]) => (
              <li key={m} className="flex items-center gap-3 text-sm">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColor(m) }}
                  aria-hidden
                />
                <span className="font-medium">{MEANING_LABELS[m]}</span>
                <div className="ml-auto flex w-1/2 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(n / withStatus) * 100}%`,
                        backgroundColor: statusColor(m),
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs tabular-nums text-muted">
                    {n}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Aktivita 12 měsíců */}
      <section className="mt-3 rounded-xl border border-line bg-card p-5">
        <h2 className="text-base font-bold tracking-tight">
          Dokončeno za posledních 12 měsíců
        </h2>
        <div className="mt-5 flex h-40 items-end gap-2">
          {months.map((m, i) => (
            <div
              key={i}
              className="flex flex-1 flex-col items-center gap-1.5"
              title={`${m.label}: ${m.count}`}
            >
              <span className="text-[10px] tabular-nums text-muted/80">
                {m.count > 0 ? m.count : ""}
              </span>
              <div
                className="w-full rounded-t-md bg-green/85"
                style={{
                  height: `${(m.count / monthMax) * 110}px`,
                  minHeight: m.count > 0 ? "4px" : "2px",
                  opacity: m.count > 0 ? 1 : 0.18,
                }}
              />
              <span className="text-[10px] text-muted/70">{m.label}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
