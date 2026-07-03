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
- [x] 5. Automatické hledání obálek — Edge Function `search-covers`
- [x] 6. Nastavení číselníků (typy, platformy vč. přiřazení, stavy) + export/import JSON
- [ ] 7. IGDB adaptér (hry) — zbývá; vyžaduje Twitch OAuth

Navíc: stránka **Statistiky** (podle typu, stavu, aktivita za 12 měsíců).

## Vizuál

Dashboardový mockup 1:1 — near-black `#0B0B0D`, amber akcent `#F0A33C`,
zelená/modrá sémantika, Inter, ikony typů médií, pill chips, status pilulky
s tečkou, „flashy“ hover (nadzvednutí + záře), mobile-first (na mobilu spodní
lišta s FAB). CSS proměnné v [app/globals.css](app/globals.css).

## Hledání obálek (Edge Function)

`supabase/functions/search-covers` — adaptéry TMDb (film/seriál/dokument),
Google Books + Open Library (knihy), iTunes (podcasty), AniList (manga/anime),
cache do `image_search_results` (TTL 30 dní). Nasazení a klíč:

```bash
npx supabase secrets set TMDB_API_KEY=<klíč>
npx supabase functions deploy search-covers --use-api   # bez Dockeru
```

Typy bez adaptéru (hra, komiks, desková hra) vrací srozumitelnou hlášku
a spoléhají na ruční obálku. ČSFD se nescrapuje (návrh 3.2) — jen ruční odkaz.

Supabase CLI je propojené (`supabase link`), migrace se posílají `npx supabase db push`.
