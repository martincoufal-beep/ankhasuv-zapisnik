"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ItemWithRelations, MediaType, StatusMeaning } from "@/lib/types";
import { MEANING_LABELS } from "@/lib/types";
import ItemCard from "./ItemCard";
import { TypeIcon } from "./icons";

type SortKey = "created" | "title" | "rating" | "finished";

const SORT_LABELS: Record<SortKey, string> = {
  created: "Nedávno přidané",
  title: "Podle názvu",
  rating: "Podle hodnocení",
  finished: "Podle dokončení",
};

export default function Library({
  items,
  mediaTypes,
  initialSearch = "",
  initialTypeId = null,
  isView = false,
}: {
  items: ItemWithRelations[];
  mediaTypes: MediaType[];
  initialSearch?: string;
  initialTypeId?: string | null;
  /** true = předfiltrovaný pohled ze sidebary (Rozpracováno…) — skryje chips stavů */
  isView?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<string | null>(initialTypeId);
  const [meaningFilter, setMeaningFilter] = useState<StatusMeaning | null>(null);
  const [sort, setSort] = useState<SortKey>("created");

  const usedTypeIds = useMemo(
    () => new Set(items.map((i) => i.media_type_id)),
    [items]
  );
  const usedMeanings = useMemo(() => {
    const set = new Set<StatusMeaning>();
    items.forEach((i) => i.status && set.add(i.status.meaning));
    return set;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (typeFilter && item.media_type_id !== typeFilter) return false;
      if (meaningFilter && item.status?.meaning !== meaningFilter) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
    const collator = new Intl.Collator("cs");
    return filtered.sort((a, b) => {
      switch (sort) {
        case "title":
          return collator.compare(a.title, b.title);
        case "rating":
          return (b.rating ?? -1) - (a.rating ?? -1);
        case "finished":
          return (b.end_date ?? "").localeCompare(a.end_date ?? "");
        default:
          return b.created_at.localeCompare(a.created_at);
      }
    });
  }, [items, search, typeFilter, meaningFilter, sort]);

  const hasFilters = Boolean(search.trim() || typeFilter || meaningFilter);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-2xl font-bold tracking-tight">
          {isView ? "Tenhle pohled je zatím prázdný." : "Zápisník je zatím prázdný."}
        </p>
        <p className="mt-3 leading-relaxed text-muted">
          {isView
            ? "Jakmile nějakému příběhu nastavíš odpovídající stav, objeví se tady."
            : "Který příběh do něj zapíšeš první? Rozehraná hra, rozečtená kniha i film, na který se teprve chystáš — všechno sem patří."}
        </p>
        <Link
          href="/pridat"
          className="btn-accent mt-6 inline-block rounded-lg px-5 py-2.5"
        >
          Zapsat položku
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Hledání + řazení */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat v zápisníku…"
          aria-label="Hledat v zápisníku"
          className="transition-quick w-full max-w-xs rounded-lg border border-line bg-card px-3.5 py-2 text-sm placeholder:text-muted/60 hover:border-[#34343b] focus:border-brass/60"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label="Řazení"
          className="transition-quick ml-auto rounded-lg border border-line bg-card px-2.5 py-2 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
        >
          {Object.entries(SORT_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Pill chips typů */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => setTypeFilter(null)}
          className={
            typeFilter === null
              ? "btn-accent rounded-full px-3.5 py-1.5 text-sm"
              : "transition-quick rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
          }
        >
          Vše
        </button>
        {mediaTypes
          .filter((t) => usedTypeIds.has(t.id))
          .map((t) => {
            const active = typeFilter === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTypeFilter(active ? null : t.id)}
                aria-pressed={active}
                className={
                  active
                    ? "btn-accent flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm"
                    : "transition-quick flex items-center gap-1.5 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
                }
              >
                <TypeIcon slug={t.slug} size={14} />
                {t.name}
              </button>
            );
          })}
      </div>

      {/* Chips stavů (přes meaning) — v pohledech ze sidebary skryté */}
      {!isView && usedMeanings.size > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(MEANING_LABELS) as StatusMeaning[])
            .filter((m) => usedMeanings.has(m))
            .map((m) => {
              const active = meaningFilter === m;
              return (
                <button
                  key={m}
                  onClick={() => setMeaningFilter(active ? null : m)}
                  aria-pressed={active}
                  className={`transition-quick rounded-full border px-3 py-1 text-xs font-medium ${
                    active
                      ? "border-brass/70 bg-brass/10 text-brass"
                      : "border-line text-muted hover:border-[#34343b] hover:text-ink"
                  }`}
                >
                  {MEANING_LABELS[m]}
                </button>
              );
            })}
        </div>
      )}

      {/* Mřížka */}
      {visible.length === 0 ? (
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="text-xl font-bold tracking-tight">
            Tomuhle zápisu nic neodpovídá.
          </p>
          <p className="mt-2 leading-relaxed text-muted">
            Zkus jiný název, nebo odlož filtry — třeba se příběh schovává pod
            jiným stavem.
          </p>
          {hasFilters && (
            <button
              onClick={() => {
                setSearch("");
                setTypeFilter(null);
                setMeaningFilter(null);
              }}
              className="transition-quick mt-5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
            >
              Zrušit filtry
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {visible.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
