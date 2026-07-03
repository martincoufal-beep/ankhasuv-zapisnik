// Edge Function: search-covers (kap. 3 návrhu)
// GET/POST { type: <slug typu média>, q: <dotaz> } -> normalizovaní kandidáti obálek.
// Adaptéry: tmdb (film/serial/dokument, vyžaduje secret TMDB_API_KEY),
// googlebooks + Open Library (kniha/audiokniha), itunes (podcast),
// anilist (manga/anime). Výsledky se cachují do image_search_results (~30 dní).
import { createClient } from "npm:@supabase/supabase-js@2";

interface CoverResult {
  title: string;
  year: number | null;
  thumbUrl: string | null;
  fullUrl: string | null;
  source: string;
  sourceId: string;
  detailUrl: string | null;
  extra?: Record<string, unknown>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
type Json = any;

async function searchTmdb(q: string, slug: string): Promise<CoverResult[] | null> {
  const key = Deno.env.get("TMDB_API_KEY");
  if (!key) return null;
  const kind = slug === "serial" ? "tv" : "movie";
  const res = await fetch(
    `https://api.themoviedb.org/3/search/${kind}?query=${encodeURIComponent(q)}&language=cs-CZ&include_adult=false&api_key=${key}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).slice(0, 12).map((r: Json): CoverResult => {
    const title = r.title ?? r.name ?? "?";
    const date = r.release_date ?? r.first_air_date ?? "";
    return {
      title,
      year: date ? Number(date.slice(0, 4)) || null : null,
      thumbUrl: r.poster_path
        ? `https://image.tmdb.org/t/p/w185${r.poster_path}`
        : null,
      fullUrl: r.poster_path
        ? `https://image.tmdb.org/t/p/w500${r.poster_path}`
        : null,
      source: "tmdb",
      sourceId: String(r.id),
      detailUrl: `https://www.themoviedb.org/${kind}/${r.id}`,
      extra: { original: r.original_title ?? r.original_name },
    };
  }).filter((r: CoverResult) => r.thumbUrl);
}

async function searchGoogleBooks(q: string): Promise<CoverResult[]> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=12&printType=books`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []).map((it: Json): CoverResult => {
    const v = it.volumeInfo ?? {};
    const ids: Json[] = v.industryIdentifiers ?? [];
    const isbn =
      ids.find((x) => x.type === "ISBN_13")?.identifier ??
      ids.find((x) => x.type === "ISBN_10")?.identifier;
    const thumb: string | null =
      v.imageLinks?.thumbnail?.replace("http://", "https://") ?? null;
    return {
      title: v.title ?? "?",
      year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || null : null,
      thumbUrl: thumb,
      // Open Library dává větší obálky podle ISBN bez klíče
      fullUrl: isbn
        ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
        : thumb,
      source: "googlebooks",
      sourceId: it.id,
      detailUrl: v.canonicalVolumeLink ?? v.infoLink ?? null,
      extra: { authors: v.authors, pages: v.pageCount, isbn },
    };
  }).filter((r: CoverResult) => r.thumbUrl || r.fullUrl);
}

async function searchItunes(q: string): Promise<CoverResult[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?media=podcast&term=${encodeURIComponent(q)}&limit=12`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results ?? []).map((r: Json): CoverResult => ({
    title: r.collectionName ?? "?",
    year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) || null : null,
    thumbUrl: r.artworkUrl100 ?? null,
    fullUrl: r.artworkUrl600 ?? r.artworkUrl100 ?? null,
    source: "itunes",
    sourceId: String(r.collectionId),
    detailUrl: r.collectionViewUrl ?? null,
    extra: { author: r.artistName, episodes: r.trackCount },
  })).filter((r: CoverResult) => r.thumbUrl);
}

async function searchAnilist(q: string, slug: string): Promise<CoverResult[]> {
  const type = slug === "anime" ? "ANIME" : "MANGA";
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query ($search: String, $type: MediaType) {
        Page(perPage: 12) {
          media(search: $search, type: $type) {
            id
            title { romaji english }
            startDate { year }
            coverImage { large extraLarge }
            siteUrl
            episodes chapters volumes status
          }
        }
      }`,
      variables: { search: q, type },
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.data?.Page?.media ?? []).map((m: Json): CoverResult => ({
    title: m.title?.english ?? m.title?.romaji ?? "?",
    year: m.startDate?.year ?? null,
    thumbUrl: m.coverImage?.large ?? null,
    fullUrl: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null,
    source: "anilist",
    sourceId: String(m.id),
    detailUrl: m.siteUrl ?? null,
    extra: {
      episodes: m.episodes,
      chapters: m.chapters,
      volumes: m.volumes,
      status: m.status,
    },
  })).filter((r: CoverResult) => r.thumbUrl);
}

const SOURCE_FOR: Record<string, string> = {
  film: "tmdb",
  serial: "tmdb",
  dokument: "tmdb",
  kniha: "googlebooks",
  audiokniha: "googlebooks",
  podcast: "itunes",
  manga: "anilist",
  anime: "anilist",
};

const UNAVAILABLE_REASON: Record<string, string> = {
  hra: "Hledání pro hry (IGDB) vyžaduje Twitch klíč — zatím vlož obálku ručně.",
  "komiks": "Comic Vine adaptér zatím není zapnutý — zkus knihu (TPB s ISBN), nebo vlož obálku ručně.",
  "digitalni-komiks": "Comic Vine adaptér zatím není zapnutý — vlož obálku ručně.",
  "deskova-hra": "BoardGameGeek adaptér zatím není zapnutý — vlož obálku ručně.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let type = "";
  let q = "";
  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    type = String(body.type ?? "");
    q = String(body.q ?? "").trim();
  } else {
    const url = new URL(req.url);
    type = url.searchParams.get("type") ?? "";
    q = (url.searchParams.get("q") ?? "").trim();
  }
  if (!q || !type) return json({ error: "Chybí parametry type a q." }, 400);

  const source = SOURCE_FOR[type];
  if (!source) {
    return json({
      results: [],
      unavailable: true,
      reason:
        UNAVAILABLE_REASON[type] ??
        "Pro tento typ média zatím automatické hledání není.",
    });
  }

  // Cache (per uživatel, TTL 30 dní) — šetří limity externích API
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: {
        headers: { Authorization: req.headers.get("Authorization") ?? "" },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const cacheKey = q.toLowerCase();

  if (user) {
    const { data: cached } = await supabase
      .from("image_search_results")
      .select("results")
      .eq("query", cacheKey)
      .eq("media_type_slug", type)
      .eq("source", source)
      .gte(
        "fetched_at",
        new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
      )
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) return json({ results: cached.results, cached: true, source });
  }

  let results: CoverResult[] | null;
  try {
    switch (source) {
      case "tmdb":
        results = await searchTmdb(q, type);
        break;
      case "googlebooks":
        results = await searchGoogleBooks(q);
        break;
      case "itunes":
        results = await searchItunes(q);
        break;
      case "anilist":
        results = await searchAnilist(q, type);
        break;
      default:
        results = [];
    }
  } catch (e) {
    console.error(e);
    return json({ error: "Externí zdroj neodpovídá, zkus to za chvíli." }, 502);
  }

  if (results === null) {
    return json({
      results: [],
      unavailable: true,
      reason: "TMDb klíč není na serveru nastaven.",
    });
  }

  if (user && results.length > 0) {
    await supabase.from("image_search_results").insert({
      user_id: user.id,
      query: cacheKey,
      media_type_slug: type,
      source,
      results,
    });
  }

  return json({ results, source });
});
