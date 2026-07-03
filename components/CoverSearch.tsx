"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export interface CoverCandidate {
  title: string;
  year: number | null;
  thumbUrl: string | null;
  fullUrl: string | null;
  source: string;
  sourceId: string;
  detailUrl: string | null;
}

const SOURCE_LABELS: Record<string, string> = {
  tmdb: "TMDb",
  googlebooks: "Google Books",
  itunes: "iTunes",
  anilist: "AniList",
};

/**
 * Tlačítko „Najít obálku" + mřížka kandidátů z Edge Function search-covers
 * (kap. 3.3 návrhu). Volající dostane vybraného kandidáta přes onPick.
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
  const [results, setResults] = useState<CoverCandidate[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const disabled = !title.trim() || !typeSlug;

  async function search() {
    if (disabled) return;
    setOpen(true);
    setLoading(true);
    setMessage(null);
    setResults([]);
    const supabase = createClient();
    const { data, error } = await supabase.functions.invoke("search-covers", {
      body: { type: typeSlug, q: title.trim() },
    });
    setLoading(false);
    if (error) {
      setMessage("Hledání se nepovedlo — zkontroluj připojení a zkus to znovu.");
      return;
    }
    if (data.unavailable) {
      setMessage(data.reason ?? "Pro tento typ zatím automatické hledání není.");
      return;
    }
    setSource(data.source ?? null);
    setResults(data.results ?? []);
    if ((data.results ?? []).length === 0) {
      setMessage(
        "Nic se nenašlo. Zkus upravit název (originální titul funguje líp), nebo vlož obálku ručně."
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={search}
        disabled={disabled || loading}
        title={
          disabled ? "Nejdřív vyplň název a zvol typ média" : "Najít obálku online"
        }
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
                    onClick={() => {
                      onPick(r);
                      setOpen(false);
                    }}
                    className="card-hover group overflow-hidden rounded-lg border border-line bg-card text-left"
                  >
                    <span className="block aspect-[2/3] bg-bg">
                      {r.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.thumbUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                    <span className="block p-1.5">
                      <span className="block truncate text-[11px] font-semibold text-ink">
                        {r.title}
                      </span>
                      <span className="block text-[10px] text-muted">
                        {r.year ?? "?"} · {SOURCE_LABELS[r.source] ?? r.source}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between px-1">
                <span className="text-[10px] text-muted/70">
                  {source === "tmdb" && "Powered by TMDb"}
                </span>
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
