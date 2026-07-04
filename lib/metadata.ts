import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalizovaný detail z Edge Function search-covers. */
export interface ApiDetail {
  cover: { full: string | null; thumb: string | null };
  year: number | null;
  genres: string[];
  detailUrl: string | null;
  fields: Record<string, string | number>;
}

export interface ApiCandidate {
  title: string;
  year: number | null;
  thumbUrl: string | null;
  source: string;
  sourceId: string;
  /** U knih chodí detail rovnou (search vrací i metadata). */
  detail?: ApiDetail;
}

export interface SearchResponse {
  results?: ApiCandidate[];
  unavailable?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Typy, kde se název našeptává při psaní (zdroje bez klíče / s vysokými limity).
 * U komiksů/her/deskovek se šetří kvóta → hledá se až tlačítkem.
 */
export const AUTOCOMPLETE_TYPES = new Set([
  "film",
  "serial",
  "dokument",
  "kniha",
  "audiokniha",
  "anime",
  "manga",
]);

export async function searchTitles(
  supabase: SupabaseClient,
  type: string,
  q: string
): Promise<SearchResponse> {
  const { data, error } = await supabase.functions.invoke("search-covers", {
    body: { action: "search", type, q },
  });
  if (error) return { error: "network" };
  return data as SearchResponse;
}

/** Detail kandidáta — buď přiložený (knihy), nebo dotažený zvlášť. */
export async function resolveDetail(
  supabase: SupabaseClient,
  type: string,
  cand: ApiCandidate
): Promise<ApiDetail | null> {
  if (cand.detail) return cand.detail;
  const { data, error } = await supabase.functions.invoke("search-covers", {
    body: { action: "detail", type, source: cand.source, sourceId: cand.sourceId },
  });
  if (error || !data?.detail) return null;
  return data.detail as ApiDetail;
}

export const SOURCE_LABELS: Record<string, string> = {
  tmdb: "TMDb",
  anilist: "AniList",
  openlibrary: "Open Library",
  googlebooks: "Google Books",
  comicvine: "Comic Vine",
  igdb: "IGDB",
  bgg: "BoardGameGeek",
};
