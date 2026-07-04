"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  resolveDetail,
  searchTitles,
  SOURCE_LABELS,
  type ApiCandidate,
} from "@/lib/metadata";
import { Icon } from "./icons";

export interface CoverCandidate {
  title: string;
  year: number | null;
  thumbUrl: string | null;
  fullUrl: string | null;
  source: string;
}

/**
 * Tlačítko „Najít obálku" + mřížka kandidátů (kap. 3.3). Pouze obálka —
 * používá se ve správě obrázků na detailu položky. Metadata řeší formulář.
 */
export default function CoverSearch({
  title,
  typeSlug,
  onPick,
}: {
  title: string;
  typeSlug: string | null | undefined;
  onPick: (candidate: CoverCandidate) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ApiCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const disabled = !title.trim() || !typeSlug;

  async function search() {
    if (disabled || !typeSlug) return;
    setOpen(true);
    setLoading(true);
    setMessage(null);
    setResults([]);
    const supabase = createClient();
    const res = await searchTitles(supabase, typeSlug, title.trim());
    setLoading(false);
    if (res.error) {
      setMessage("Hledání se nepovedlo — zkontroluj připojení a zkus to znovu.");
      return;
    }
    if (res.unavailable) {
      setMessage(res.reason ?? "Pro tento typ zatím automatické hledání není.");
      return;
    }
    setResults(res.results ?? []);
    if ((res.results ?? []).length === 0) {
      setMessage("Nic se nenašlo. Zkus upravit název, nebo vlož obálku ručně.");
    }
  }

  async function pick(cand: ApiCandidate) {
    if (!typeSlug) return;
    setLoading(true);
    const supabase = createClient();
    const detail = await resolveDetail(supabase, typeSlug, cand);
    setLoading(false);
    onPick({
      title: cand.title,
      year: detail?.year ?? cand.year,
      thumbUrl: detail?.cover.thumb ?? cand.thumbUrl,
      fullUrl: detail?.cover.full ?? detail?.cover.thumb ?? cand.thumbUrl,
      source: cand.source,
    });
    setOpen(false);
  }

  return (
    <div>
      <button
        type="button"
        onClick={search}
        disabled={disabled || loading}
        title={disabled ? "Nejdřív vyplň název a zvol typ média" : "Najít obálku online"}
        className="transition-quick flex items-center gap-2 rounded-lg border border-brass/50 px-3 py-2 text-sm font-medium text-brass hover:border-brass hover:bg-brass/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Icon name="search" size={14} />
        {loading ? "Hledám…" : "Najít obálku"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-line bg-panel p-3">
          {loading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[2/3] rounded-lg" />
              ))}
            </div>
          ) : message ? (
            <p className="px-1 py-2 text-sm leading-relaxed text-muted">{message}</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {results.slice(0, 12).map((r) => (
                  <button
                    key={`${r.source}-${r.sourceId}`}
                    type="button"
                    onClick={() => pick(r)}
                    className="card-hover group overflow-hidden rounded-lg border border-line bg-card text-left"
                  >
                    <span className="block aspect-[2/3] bg-bg">
                      {r.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="block p-1.5">
                      <span className="block truncate text-[11px] font-semibold text-ink">{r.title}</span>
                      <span className="block text-[10px] text-muted">
                        {r.year ?? "?"} · {SOURCE_LABELS[r.source] ?? r.source}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-end px-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="transition-quick text-xs font-medium text-muted hover:text-ink"
                >
                  Zavřít
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
