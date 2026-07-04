// Edge Function: search-covers (kap. 3 návrhu) — obálky + metadata.
//
// POST { action:"search", type:<slug>, q:<dotaz> }
//   -> { results: [{ title, year, thumbUrl, source, sourceId }] }  (našeptávání + mřížka)
// POST { action:"detail", type:<slug>, source, sourceId }
//   -> { cover:{full,thumb}, year, genres:[...], detailUrl, fields:{ <source_key>: value } }
//
// Adaptéry podle typu média:
//   tmdb       film / serial / dokument   (klíč TMDB_API_KEY)
//   anilist    anime / manga              (bez klíče)
//   googlebooks kniha / audiokniha        (bez klíče, obálky Open Library dle ISBN)
//   comicvine  komiks / digitalni-komiks  (klíč COMICVINE_API_KEY)
//   igdb       hra                        (IGDB_CLIENT_ID + IGDB_CLIENT_SECRET)
//   bgg        deskova-hra                (bez klíče, XML)
import { createClient } from "npm:@supabase/supabase-js@2";

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

interface Candidate {
  title: string;
  year: number | null;
  thumbUrl: string | null;
  source: string;
  sourceId: string;
  /** U zdrojů, kde search vrací i metadata (knihy), je detail přiložený rovnou. */
  detail?: Detail;
}
interface Detail {
  cover: { full: string | null; thumb: string | null };
  year: number | null;
  genres: string[];
  detailUrl: string | null;
  fields: Record<string, string | number>;
}

const SOURCE_FOR: Record<string, string> = {
  film: "tmdb",
  serial: "tmdb",
  dokument: "tmdb",
  anime: "anilist",
  manga: "anilist",
  kniha: "books",
  audiokniha: "books",
  komiks: "comicvine",
  "digitalni-komiks": "comicvine",
  hra: "igdb",
  "deskova-hra": "bgg",
};
const UNAVAILABLE: Record<string, string> = {
  kurz: "Kurzy nemají veřejný katalog — vyplň údaje ručně.",
  ostatni: "Pro typ Ostatní se metadata nedotahují — vyplň je ručně.",
};

// ---------------------------------------------------------------- TMDb -------
const TMDB = () => Deno.env.get("TMDB_API_KEY");
function tmdbKind(slug: string) {
  return slug === "serial" ? "tv" : "movie";
}
async function tmdbSearch(q: string, slug: string): Promise<Candidate[]> {
  const key = TMDB();
  if (!key) return [];
  const kind = tmdbKind(slug);
  const r = await fetch(
    `https://api.themoviedb.org/3/search/${kind}?query=${encodeURIComponent(q)}&language=cs-CZ&include_adult=false&api_key=${key}`
  );
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results ?? [])
    .slice(0, 10)
    .map((x: Json): Candidate => {
      const date = x.release_date ?? x.first_air_date ?? "";
      return {
        title: x.title ?? x.name ?? "?",
        year: date ? Number(date.slice(0, 4)) || null : null,
        thumbUrl: x.poster_path
          ? `https://image.tmdb.org/t/p/w185${x.poster_path}`
          : null,
        source: "tmdb",
        sourceId: String(x.id),
      };
    });
}
async function tmdbDetail(id: string, slug: string): Promise<Detail> {
  const key = TMDB();
  const kind = tmdbKind(slug);
  const r = await fetch(
    `https://api.themoviedb.org/3/${kind}/${id}?language=cs-CZ&append_to_response=credits&api_key=${key}`
  );
  const d = await r.json();
  const fields: Record<string, string | number> = {};
  const date = d.release_date ?? d.first_air_date ?? "";
  const year = date ? Number(date.slice(0, 4)) || null : null;
  if (year) fields.year = year;
  if (kind === "movie") {
    const dir = (d.credits?.crew ?? []).find((c: Json) => c.job === "Director");
    if (dir) fields.director = dir.name;
    if (d.runtime) fields.runtime = d.runtime;
  } else {
    const creators = (d.created_by ?? []).map((c: Json) => c.name);
    if (creators.length) fields.creator = creators.join(", ");
    if (d.number_of_seasons) fields.seasons = d.number_of_seasons;
    if (d.number_of_episodes) fields.episodes = d.number_of_episodes;
    if (d.status) fields.status = d.status;
  }
  return {
    cover: {
      full: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : null,
      thumb: d.poster_path ? `https://image.tmdb.org/t/p/w185${d.poster_path}` : null,
    },
    year,
    genres: (d.genres ?? []).map((g: Json) => g.name),
    detailUrl: `https://www.themoviedb.org/${kind}/${id}`,
    fields,
  };
}

// ------------------------------------------------------------- AniList -------
async function anilistGql(query: string, variables: Json): Promise<Json> {
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return r.ok ? await r.json() : null;
}
async function anilistSearch(q: string, slug: string): Promise<Candidate[]> {
  const type = slug === "anime" ? "ANIME" : "MANGA";
  const d = await anilistGql(
    `query($s:String,$t:MediaType){Page(perPage:10){media(search:$s,type:$t){id title{romaji english} startDate{year} coverImage{large}}}}`,
    { s: q, t: type }
  );
  return (d?.data?.Page?.media ?? []).map((m: Json): Candidate => ({
    title: m.title?.english ?? m.title?.romaji ?? "?",
    year: m.startDate?.year ?? null,
    thumbUrl: m.coverImage?.large ?? null,
    source: "anilist",
    sourceId: String(m.id),
  }));
}
async function anilistDetail(id: string, slug: string): Promise<Detail> {
  const d = await anilistGql(
    `query($id:Int){Media(id:$id){id title{romaji english} startDate{year} genres status episodes volumes chapters siteUrl coverImage{extraLarge large} studios(isMain:true){nodes{name}} staff(perPage:4){edges{role node{name{full}}}}}}`,
    { id: Number(id) }
  );
  const m = d?.data?.Media ?? {};
  const fields: Record<string, string | number> = {};
  if (m.startDate?.year) fields.year = m.startDate.year;
  if (m.status) fields.status = m.status;
  if (slug === "anime") {
    if (m.episodes) fields.episodes = m.episodes;
    const studio = m.studios?.nodes?.[0]?.name;
    if (studio) fields.studio = studio;
  } else {
    if (m.volumes) fields.volumes = m.volumes;
    if (m.chapters) fields.chapters = m.chapters;
    const author = (m.staff?.edges ?? []).find((e: Json) =>
      /story|art/i.test(e.role ?? "")
    );
    if (author) fields.author = author.node?.name?.full;
  }
  return {
    cover: { full: m.coverImage?.extraLarge ?? m.coverImage?.large ?? null, thumb: m.coverImage?.large ?? null },
    year: m.startDate?.year ?? null,
    genres: m.genres ?? [],
    detailUrl: m.siteUrl ?? null,
    fields,
  };
}

// ------------------------------------------------------- Open Library -------
// Primární zdroj knih (bez klíče, štědré limity). Google Books je jen fallback,
// protože jeho bezklíčová kvóta je sdílená a často vyčerpaná (429).
const OL_UA = "AnkhasuvZapisnik/1.0 (osobni knihovna)";
const OL_FIELDS =
  "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,publisher,language,subject";
function olCover(doc: Json, size: "M" | "L"): string | null {
  if (doc.cover_i) return `https://covers.openlibrary.org/b/id/${doc.cover_i}-${size}.jpg`;
  const isbn = (doc.isbn ?? [])[0];
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg` : null;
}
// Kód jazyka → čitelný název (nejčastější); ostatní zůstanou kódem.
const LANG: Record<string, string> = {
  cze: "čeština", ces: "čeština", cs: "čeština",
  eng: "angličtina", en: "angličtina",
  ger: "němčina", deu: "němčina", de: "němčina",
  fre: "francouzština", fra: "francouzština", fr: "francouzština",
  slo: "slovenština", slk: "slovenština", sk: "slovenština",
  jpn: "japonština", ja: "japonština", pol: "polština", spa: "španělština",
};
function olDetailFromDoc(doc: Json): Detail {
  const fields: Record<string, string | number> = {};
  if (doc.author_name?.length) fields.author = doc.author_name.join(", ");
  if (doc.publisher?.length) fields.publisher = doc.publisher[0];
  if (doc.number_of_pages_median) fields.pages = doc.number_of_pages_median;
  if (doc.first_publish_year) fields.year = doc.first_publish_year;
  if (doc.language?.length) fields.language = LANG[doc.language[0]] ?? doc.language[0];
  if (doc.isbn?.length) fields.isbn = doc.isbn[0];
  return {
    cover: { full: olCover(doc, "L"), thumb: olCover(doc, "M") },
    year: doc.first_publish_year ?? null,
    genres: (doc.subject ?? []).slice(0, 6),
    detailUrl: doc.key ? `https://openlibrary.org${doc.key}` : null,
    fields,
  };
}
function gbDetailFromVolume(v: Json): Detail {
  const ids: Json[] = v.industryIdentifiers ?? [];
  const isbn =
    ids.find((x) => x.type === "ISBN_13")?.identifier ??
    ids.find((x) => x.type === "ISBN_10")?.identifier;
  const fields: Record<string, string | number> = {};
  if (v.authors?.length) fields.author = v.authors.join(", ");
  if (v.publisher) fields.publisher = v.publisher;
  if (v.pageCount) fields.pages = v.pageCount;
  if (v.publishedDate) fields.year = Number(v.publishedDate.slice(0, 4)) || 0;
  if (v.language) fields.language = LANG[v.language] ?? v.language;
  if (isbn) fields.isbn = isbn;
  const thumb = v.imageLinks?.thumbnail?.replace("http://", "https://") ?? null;
  return {
    cover: { full: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : thumb, thumb },
    year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || null : null,
    genres: v.categories ?? [],
    detailUrl: v.canonicalVolumeLink ?? v.infoLink ?? null,
    fields,
  };
}
// Knihy: search.json vrací všechna metadata → detail přikládáme ke kandidátovi
// (druhé volání OL bývá z datacentra nespolehlivé).
async function booksSearch(q: string): Promise<Candidate[]> {
  const r = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=10&fields=${OL_FIELDS}`,
    { headers: { "User-Agent": OL_UA } }
  );
  if (r.ok) {
    const d = await r.json();
    const docs = d.docs ?? [];
    if (docs.length > 0) {
      return docs.map((doc: Json): Candidate => ({
        title: doc.title ?? "?",
        year: doc.first_publish_year ?? null,
        thumbUrl: olCover(doc, "M"),
        source: "openlibrary",
        sourceId: (doc.key ?? "").replace("/works/", ""),
        detail: olDetailFromDoc(doc),
      }));
    }
  }
  // Fallback Google Books
  const g = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&printType=books`
  );
  if (!g.ok) return [];
  const gd = await g.json();
  return (gd.items ?? []).map((it: Json): Candidate => {
    const v = it.volumeInfo ?? {};
    return {
      title: v.title ?? "?",
      year: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) || null : null,
      thumbUrl: v.imageLinks?.thumbnail?.replace("http://", "https://") ?? null,
      source: "googlebooks",
      sourceId: it.id,
      detail: gbDetailFromVolume(v),
    };
  });
}

// ----------------------------------------------------------- Comic Vine -----
const CV_UA = "AnkhasuvZapisnik/1.0 (osobni knihovna)";
async function comicvineSearch(q: string): Promise<Candidate[]> {
  const key = Deno.env.get("COMICVINE_API_KEY");
  if (!key) return [];
  const r = await fetch(
    `https://comicvine.gamespot.com/api/search/?api_key=${key}&format=json&resources=volume&limit=10&query=${encodeURIComponent(q)}&field_list=id,name,start_year,image`,
    { headers: { "User-Agent": CV_UA } }
  );
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results ?? []).map((v: Json): Candidate => ({
    title: v.name ?? "?",
    year: v.start_year ? Number(v.start_year) || null : null,
    thumbUrl: v.image?.small_url ?? v.image?.thumb_url ?? null,
    source: "comicvine",
    sourceId: String(v.id),
  }));
}
async function comicvineDetail(id: string): Promise<Detail> {
  const key = Deno.env.get("COMICVINE_API_KEY");
  const r = await fetch(
    `https://comicvine.gamespot.com/api/volume/4050-${id}/?api_key=${key}&format=json&field_list=name,start_year,image,publisher,people,site_detail_url`,
    { headers: { "User-Agent": CV_UA } }
  );
  const d = await r.json();
  const v = d.results ?? {};
  const fields: Record<string, string | number> = {};
  if (v.name) fields.series = v.name;
  if (v.start_year) fields.year = Number(v.start_year) || 0;
  if (v.publisher?.name) fields.publisher = v.publisher.name;
  const people: Json[] = v.people ?? [];
  const writer = people.find((p) => /writer/i.test(p.role ?? ""));
  const artist = people.find((p) => /(artist|penciler|penciller|inker)/i.test(p.role ?? ""));
  if (writer) fields.writer = writer.name;
  if (artist) fields.artist = artist.name;
  return {
    cover: { full: v.image?.super_url ?? v.image?.original_url ?? null, thumb: v.image?.small_url ?? null },
    year: v.start_year ? Number(v.start_year) || null : null,
    genres: [],
    detailUrl: v.site_detail_url ?? null,
    fields,
  };
}

// ---------------------------------------------------------------- IGDB ------
let igdbToken: { token: string; exp: number } | null = null;
async function igdbAuth(): Promise<string | null> {
  const id = Deno.env.get("IGDB_CLIENT_ID");
  const secret = Deno.env.get("IGDB_CLIENT_SECRET");
  if (!id || !secret) return null;
  if (igdbToken && igdbToken.exp > Date.now() + 60000) return igdbToken.token;
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: "POST" }
  );
  if (!r.ok) return null;
  const d = await r.json();
  igdbToken = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}
async function igdbQuery(body: string): Promise<Json> {
  const token = await igdbAuth();
  if (!token) return null;
  const r = await fetch("https://api.igdb.com/v4/games", {
    method: "POST",
    headers: {
      "Client-ID": Deno.env.get("IGDB_CLIENT_ID")!,
      Authorization: `Bearer ${token}`,
    },
    body,
  });
  return r.ok ? await r.json() : null;
}
async function igdbSearch(q: string): Promise<Candidate[] | null> {
  const rows = await igdbQuery(
    `search "${q.replace(/"/g, "")}"; fields name,first_release_date,cover.image_id; limit 10;`
  );
  if (rows === null) return null;
  return rows.map((g: Json): Candidate => ({
    title: g.name ?? "?",
    year: g.first_release_date
      ? new Date(g.first_release_date * 1000).getUTCFullYear()
      : null,
    thumbUrl: g.cover?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cover.image_id}.jpg`
      : null,
    source: "igdb",
    sourceId: String(g.id),
  }));
}
async function igdbDetail(id: string): Promise<Detail> {
  const rows = await igdbQuery(
    `fields name,first_release_date,cover.image_id,genres.name,game_modes.name,url,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; where id = ${Number(id)};`
  );
  const g = rows?.[0] ?? {};
  const fields: Record<string, string | number> = {};
  const year = g.first_release_date
    ? new Date(g.first_release_date * 1000).getUTCFullYear()
    : null;
  if (year) fields.year = year;
  const dev = (g.involved_companies ?? []).find((c: Json) => c.developer);
  const pub = (g.involved_companies ?? []).find((c: Json) => c.publisher);
  if (dev?.company?.name) fields.developer = dev.company.name;
  if (pub?.company?.name) fields.publisher = pub.company.name;
  const modes = (g.game_modes ?? []).map((m: Json) => m.name);
  if (modes.length) fields.modes = modes.join(", ");
  return {
    cover: {
      full: g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
        : null,
      thumb: g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_small/${g.cover.image_id}.jpg`
        : null,
    },
    year,
    genres: (g.genres ?? []).map((x: Json) => x.name),
    detailUrl: g.url ?? null,
    fields,
  };
}

// ----------------------------------------------------------------- BGG ------
function xmlAll(xml: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}
const BGG_UA = "AnkhasuvZapisnik/1.0 (osobni knihovna)";
async function bggSearch(q: string): Promise<Candidate[]> {
  const r = await fetch(
    `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": BGG_UA } }
  );
  if (!r.ok) return [];
  const xml = await r.text();
  const items = xml.split("<item ").slice(1, 11);
  return items.map((it): Candidate => {
    const id = it.match(/id="(\d+)"/)?.[1] ?? "";
    const name = it.match(/<name[^>]*value="([^"]*)"/)?.[1] ?? "?";
    const year = it.match(/<yearpublished[^>]*value="(\d+)"/)?.[1];
    return {
      title: name,
      year: year ? Number(year) : null,
      thumbUrl: null, // miniatura až v detailu (search ji nevrací)
      source: "bgg",
      sourceId: id,
    };
  });
}
async function bggDetail(id: string): Promise<Detail> {
  const r = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${id}&stats=1`, {
    headers: { "User-Agent": BGG_UA },
  });
  const xml = await r.text();
  const val = (tag: string) => xml.match(new RegExp(`<${tag}[^>]*value="([^"]*)"`))?.[1];
  const image = xml.match(/<image>([^<]*)<\/image>/)?.[1] ?? null;
  const thumb = xml.match(/<thumbnail>([^<]*)<\/thumbnail>/)?.[1] ?? null;
  const fields: Record<string, string | number> = {};
  const year = val("yearpublished");
  if (year) fields.year = Number(year);
  const min = val("minplayers");
  const max = val("maxplayers");
  if (min || max) fields.players = min && max ? `${min}–${max}` : (min ?? max)!;
  const time = val("playingtime");
  if (time) fields.playtime = Number(time);
  const designer = xmlAll(
    xml,
    /<link[^>]*type="boardgamedesigner"[^>]*value="([^"]*)"/g
  );
  if (designer.length) fields.designer = designer.join(", ");
  const genres = xmlAll(
    xml,
    /<link[^>]*type="boardgamecategory"[^>]*value="([^"]*)"/g
  );
  return {
    cover: { full: image, thumb: thumb ?? image },
    year: year ? Number(year) : null,
    genres,
    detailUrl: `https://boardgamegeek.com/boardgame/${id}`,
    fields,
  };
}

// --------------------------------------------------------------- router -----
async function runSearch(source: string, q: string, slug: string): Promise<Candidate[] | null> {
  switch (source) {
    case "tmdb": return tmdbSearch(q, slug);
    case "anilist": return anilistSearch(q, slug);
    case "books": return booksSearch(q);
    case "comicvine": return comicvineSearch(q);
    case "igdb": return igdbSearch(q); // null = klíč chybí
    case "bgg": return bggSearch(q);
    default: return [];
  }
}
async function runDetail(source: string, id: string, slug: string): Promise<Detail> {
  switch (source) {
    case "tmdb": return tmdbDetail(id, slug);
    case "anilist": return anilistDetail(id, slug);
    // openlibrary / googlebooks: detail chodí inline v kandidátovi (viz booksSearch)
    case "comicvine": return comicvineDetail(id);
    case "igdb": return igdbDetail(id);
    case "bgg": return bggDetail(id);
    default: return { cover: { full: null, thumb: null }, year: null, genres: [], detailUrl: null, fields: {} };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "search");
  const type = String(body.type ?? "");
  const source = SOURCE_FOR[type];

  if (!source) {
    return json({
      results: [],
      unavailable: true,
      reason: UNAVAILABLE[type] ?? "Pro tento typ se metadata nedotahují.",
    });
  }

  // ---- detail: plná metadata pro jednoho kandidáta ----
  if (action === "detail") {
    const sourceId = String(body.sourceId ?? "");
    if (!sourceId) return json({ error: "Chybí sourceId." }, 400);
    try {
      const detail = await runDetail(source, sourceId, type);
      return json({ detail, source });
    } catch (e) {
      console.error(e);
      return json({ error: "Detail se nepodařilo načíst." }, 502);
    }
  }

  // ---- search: kandidáti (našeptávání + mřížka obálek), s cache ----
  const q = String(body.q ?? "").trim();
  if (!q) return json({ error: "Chybí dotaz q." }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const cacheKey = q.toLowerCase();

  if (user) {
    const { data: cached } = await supabase
      .from("image_search_results")
      .select("results")
      .eq("query", cacheKey).eq("media_type_slug", type).eq("source", source)
      .gte("fetched_at", new Date(Date.now() - 30 * 864e5).toISOString())
      .order("fetched_at", { ascending: false }).limit(1).maybeSingle();
    if (cached) return json({ results: cached.results, cached: true, source });
  }

  let results: Candidate[] | null;
  try {
    results = await runSearch(source, q, type);
  } catch (e) {
    console.error(e);
    return json({ error: "Externí zdroj neodpovídá, zkus to za chvíli." }, 502);
  }

  if (results === null) {
    return json({
      results: [],
      unavailable: true,
      reason: "Zdroj pro hry (IGDB) zatím není nastavený — vyplň údaje ručně.",
    });
  }

  if (user && results.length > 0) {
    await supabase.from("image_search_results").insert({
      user_id: user.id, query: cacheKey, media_type_slug: type, source, results,
    });
  }
  return json({ results, source });
});
