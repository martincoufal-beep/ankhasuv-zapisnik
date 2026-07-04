# Ankhasův zápisník

Osobní knihovna prožitých příběhů — hry, filmy, seriály, knihy, komiksy
i podcasty na jednom místě. Next.js (App Router, TypeScript, Tailwind)
+ Supabase (Postgres, Auth, RLS).

Kompletní návrh: [regal-navrh-v2.md](regal-navrh-v2.md) (pracovní název
„Regál" — finální název aplikace je Ankhasův zápisník).

## Spuštění

```bash
npm install
npm run dev        # http://localhost:3000
```

Vyžaduje `.env.local` s `NEXT_PUBLIC_SUPABASE_URL`
a `NEXT_PUBLIC_SUPABASE_ANON_KEY` (není ve verzování).

## Databáze

Migrace žijí v `supabase/migrations/`. Aplikace na vzdálený projekt:

```bash
npx supabase db push --db-url "postgresql://postgres.<ref>:<heslo>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres"
```

(Přímé připojení `db.<ref>.supabase.co` je jen IPv6 — na IPv4 síti
použij session pooler jako výše.)

## Stav MVP (kap. 11 návrhu)

- [x] 1. Základ: schéma + seed + RLS, Auth přes magic link
- [x] 2. Knihovna: mřížka karet, filtry (typ, stav), hledání, řazení
- [x] 3. Podmíněný formulář podle typu média, hodnocení s polovinami hvězd
- [x] 4. Obrázky (upload s WebP kompresí, URL, hlavní obálka, mazání)
- [x] 5. Obálky **i metadata** z API (viz níže) + našeptávání názvu
- [x] 6. Nastavení číselníků (typy, platformy vč. přiřazení, stavy) + export/import JSON
- [x] 7. IGDB adaptér (hry) — kód hotový, čeká na `IGDB_CLIENT_SECRET`

Navíc: stránka **Statistiky** (podle typu, stavu, aktivita za 12 měsíců).
Kategorie: 13 (odebrány podcast, článek, YouTube série). Výběr přes dropdown.

## Vizuál

Dashboardový mockup 1:1 — near-black `#0B0B0D`, amber akcent `#F0A33C`,
zelená/modrá sémantika, Inter, ikony typů médií, pill chips, status pilulky
s tečkou, „flashy“ hover (nadzvednutí + záře), mobile-first (na mobilu spodní
lišta s FAB). CSS proměnné v [app/globals.css](app/globals.css).

## Obálky + metadata z API (Edge Function)

`supabase/functions/search-covers` má dva režimy: `action:"search"` (kandidáti
pro našeptávání a mřížku) a `action:"detail"` (obálka + žánry + metadata).
Metadata se mapují do polí položky přes `custom_fields.source_key`
(director, author, year, publisher, writer, developer…). Cache do
`image_search_results` (TTL 30 dní).

| Kategorie | Zdroj | Klíč | Vytažená pole |
|---|---|---|---|
| Film / Seriál / Dokument | TMDb | `TMDB_API_KEY` | režisér/tvůrce, žánry (cs), rok, délka, série/epizody, stav |
| Anime / Manga | AniList | — | studio/autor, žánry, rok, epizody/svazky/kapitoly, stav |
| Kniha / Audiokniha | Open Library (fallback Google Books) | — | autor, nakladatel, rok, strany, jazyk, ISBN, žánry |
| Komiks / Digitální komiks | Comic Vine | `COMICVINE_API_KEY` | série, vydavatel, rok, scénárista/kreslíř (best-effort) |
| Hra | IGDB | `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET` | vývojář, vydavatel, žánry, rok, herní módy |
| Desková hra | BoardGameGeek | — | autor, počet hráčů, délka, rok, kategorie |
| Kurz / Ostatní | — | — | jen ruční zadání |

```bash
npx supabase secrets set TMDB_API_KEY=<klíč> COMICVINE_API_KEY=<klíč> \
  IGDB_CLIENT_ID=<id> IGDB_CLIENT_SECRET=<secret>
npx supabase functions deploy search-covers --use-api   # bez Dockeru
```

**Našeptávání**: u bezklíčových / vysokolimitních zdrojů (film, seriál, dokument,
kniha, audiokniha, anime, manga) se název našeptává při psaní; u komiksů, her
a deskovek se hledá tlačítkem (šetří kvótu). Opětovné dotažení doplní jen
prázdná pole. Žánry z API se zakládají automaticky. Chybějící údaj se prostě
nezobrazí; chybějící obálka → placeholder s iniciálami. ČSFD se nescrapuje.

**Poznámky k provozu:** IGDB potřebuje i Client Secret (jen ID nestačí) —
dokud není v secrets, hry hlásí „vyplň ručně". BoardGameGeek občas vrací 401
(blokace serverových IP) — pak desková hra spadne na ruční zadání.

## Rozšíření o novou kategorii

1. V Nastavení přidej typ (`media_types`) a jeho pole (`custom_fields`) —
   u pole nastav `source_key`, pokud se má plnit z API.
2. Když stačí existující zdroj, nastav `default_adapter` na `tmdb`/`igdb`/…
   a je hotovo — **bez zásahu do kódu**.
3. Jen pro úplně nový zdroj se přidá adaptér (~30 řádků) do Edge Function.

Supabase CLI je propojené (`supabase link`), migrace se posílají `npx supabase db push`.
