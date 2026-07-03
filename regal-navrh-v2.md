# Regál v2 — revidovaný návrh aplikace

Osobní multimediální knihovna: hry, filmy, seriály, knihy, komiksy a další.
Návrh zapracovává připomínky k prototypu a počítá s přechodem z jednoduchého
prototypu na plnohodnotnou webovou aplikaci.

---

## 1. Shrnutí změn oproti původnímu prototypu

Původní prototyp byl jednouživatelská React aplikace s jedním úložným klíčem
(key–value storage), plochým seznamem položek, globálními platformami a čtyřmi
pevnými stavy. To pro požadované funkce nestačí — hlavně kvůli uploadu obrázků,
API klíčům a relačním vazbám mezi číselníky.

**Zásadní architektonická změna:** aplikace se přesouvá na stack
**React (Next.js) + Supabase** (Postgres, Auth, Storage, Edge Functions).
Důvody:

| Požadavek | Proč to prototyp neumí | Řešení v Supabase |
|---|---|---|
| Upload obrázků ze zařízení | key–value storage má limit 5 MB na klíč a neumí binární soubory | Supabase Storage (bucket + RLS) |
| Automatické hledání obálek | API klíče (IGDB, TMDb) nesmí být v prohlížeči | Edge Functions jako proxy, klíče v secrets |
| Vazby typ ↔ platforma ↔ stav | jeden JSON blob se špatně dotazuje a škáluje | relační schéma v Postgres |
| Vlastní pole podle typu | pevná struktura položky | tabulky `custom_fields` + `custom_field_values` |
| Přístup z více zařízení | data žila jen v jedné konverzaci | Supabase Auth + cloudová DB |

**Co se mění funkčně:**

1. Obrázky: upload, více obrázků na položku, galerie, hlavní obálka, automatické hledání přes oficiální API.
2. Číselníky (typy, platformy, stavy, žánry, tagy) jsou relační a podmíněné typem média.
3. Stavy mají dvouvrstvý model: interní význam + label podle typu média.
4. Formulář je dynamický — skládá se podle zvoleného typu média.
5. Vlastní pole definovatelná uživatelem, bez zásahu do kódu.
6. Nastavení se stává plnohodnotnou administrací číselníků a zdrojů metadat.

**Co zůstává:** celková logika knihovny (karty s obálkami, detail, hodnocení
s polovinami hvězd, poznámky/recenze, data začátku a konce, proklik na externí
databázi, export/import JSON jako záloha).

---

## 2. Nový návrh práce s obrázky a uploadem

### 2.1 Datový model

Obrázky dostávají vlastní tabulku — jedna položka může mít libovolný počet
obrázků různých rolí:

```sql
create table images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references items(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  kind        text not null default 'cover',
              -- 'cover' | 'alt_cover' | 'screenshot' | 'photo' | 'background'
  source      text not null,          -- 'upload' | 'url' | 'api'
  storage_path text,                  -- cesta v Supabase Storage (u uploadů)
  external_url text,                  -- URL (u externích obrázků)
  source_name  text,                  -- 'tmdb' | 'igdb' | 'openlibrary' | ...
  is_primary  boolean not null default false,
  width       int,
  height      int,
  created_at  timestamptz default now()
);

-- jen jeden hlavní obrázek na položku:
create unique index one_primary_per_item
  on images(item_id) where is_primary;
```

Buď je vyplněná `storage_path` (soubor leží u nás), nebo `external_url`
(hotlink na externí zdroj). Sloupec `kind` pokrývá všechny požadované role:
hlavní obálka, alternativní obálky, screenshoty, vlastní fotky fyzických kusů
i vizuál na pozadí detailu.

### 2.2 Upload ze zařízení — jak to funguje v praxi

1. Uživatel klikne na „Nahrát obrázek" (nebo přetáhne soubor / na mobilu vyfotí).
2. Klient obrázek před uploadem zmenší a překonvertuje na WebP
   (canvas nebo knihovna `browser-image-compression`) — cíl ~1600 px delší
   strana, ~200–400 kB. Šetří to storage i rychlost načítání gridu.
3. Upload do bucketu `covers` na cestu `{user_id}/{item_id}/{uuid}.webp`.
4. Zapíše se řádek do `images` se `source = 'upload'`.

Zabezpečení přes RLS politiku na Storage: uživatel smí číst a zapisovat jen
pod prefixem svého `user_id`. Bucket může být privátní (obrázky se servírují
přes signed URL s cache) — pro čistě osobní aplikaci stačí i public bucket
s neuhodnutelnými cestami.

### 2.3 Externí URL

Ruční vložení URL zůstává: zapíše se `source = 'url'`, `external_url`.
Náhled se ověří přímo v prohlížeči (`onError` → upozornění, že obrázek nejde
načíst — některé weby hotlink blokují).

**Volitelná „materializace":** u externího obrázku bude tlačítko *Uložit kopii
k sobě*. Edge Function obrázek stáhne, zmenší a uloží do Storage, řádek se
překlopí na `source = 'upload'`. Chrání to knihovnu před „hnitím" odkazů
(externí web obrázek smaže nebo přesune). Doporučené výchozí chování: obálky
z API materializovat automaticky, ruční URL nechat na uživateli.

### 2.4 Správa obrázků na položce

V detailu položky bude záložka **Obrázky**:

* mřížka všech obrázků položky s badge role (obálka / screenshot / fotka…),
* „Nastavit jako hlavní" — transakčně shodí `is_primary` starému a nastaví novému,
* „Smazat" — smaže řádek a (u uploadů) i soubor ze Storage; mazání souboru
  řeší Edge Function nebo databázový trigger, aby nevznikaly sirotky,
* změna role obrázku (z alternativní obálky udělat hlavní apod.),
* upload i vyhledání dalších obrázků přímo odsud.

---

## 3. Návrh automatického hledání obálek

### 3.1 Architektura: adaptéry za serverovou proxy

Přímé volání API z prohlížeče nepřipadá v úvahu tam, kde je potřeba tajný klíč
(IGDB, TMDb, Comic Vine, Google CSE). Řešením je jedna Edge Function:

```
GET /functions/v1/search-covers?type=game&q=disco+elysium
```

Funkce podle `type` vybere adaptér, zavolá externí API se svým klíčem
(uloženým v Supabase secrets, nikdy v klientovi) a vrátí **normalizovaný**
výsledek:

```json
[{
  "title": "Disco Elysium",
  "year": 2019,
  "thumbUrl": "https://…/t_cover_small/….jpg",
  "fullUrl":  "https://…/t_cover_big/….jpg",
  "source": "igdb",
  "sourceId": "119171",
  "detailUrl": "https://www.igdb.com/games/disco-elysium",
  "extra": { "platforms": ["PC", "PS5"], "developer": "ZA/UM" }
}]
```

Díky normalizaci je UI pro výběr obálky jedno jediné, bez ohledu na zdroj.

### 3.2 Doporučené zdroje podle typu média

| Typ média | Primární zdroj | Poznámky k realitě provozu |
|---|---|---|
| Film, seriál, dokument | **TMDb API** | zdarma pro osobní použití, klíč nutný, obrázky na `image.tmdb.org` (hotlink povolen), vyžaduje uvedení atribuce „powered by TMDb"; vrací i rok, režiséra, počet sérií |
| Hra | **IGDB API** | klíč přes Twitch Developer (OAuth client credentials) — **musí** běžet přes server, token se cachuje ~60 dní; obálky `t_cover_big`, vrací i platformy a datum vydání |
| Kniha, audiokniha | **Google Books API** + **Open Library Covers** | Google Books funguje pro vyhledávání i bez klíče (nízké limity), vrací autora, počet stran, ISBN; Open Library pak dává kvalitní obálky přes `covers.openlibrary.org/b/isbn/{isbn}-L.jpg` bez klíče |
| Komiks | **Comic Vine API** | zdarma s klíčem, limit ~200 dotazů/hod, vyžaduje vlastní User-Agent; zná série, svazky, scénáristy i kreslíře. Pro TPB/omnibusy s ISBN funguje i Google Books |
| Manga, anime | **AniList GraphQL** (bez klíče) nebo Jikan (MyAnimeList) | AniList vrací obálky, počet svazků/epizod, statusy vydávání; ideální doplněk ke Comic Vine |
| Podcast | **iTunes Search API** | bez klíče, `media=podcast`, vrací artwork až 600 px — nejjednodušší adaptér ze všech |
| Desková hra | **BoardGameGeek XML API2** | bez klíče, XML, dvoufázové (search → thing), občas pomalé — hodí se cachovat |
| YouTube série, kurz, článek, ostatní | **Google Custom Search JSON API** (searchType=image) | jediná legální „obecná" cesta místo scrapingu Google obrázků; 100 dotazů denně zdarma, pak placené — proto jen jako fallback, ne výchozí cesta |

**Co záměrně nedělat:** scraping Google Images (křehké, proti podmínkám),
neoficiální ČSFD „API" (neexistuje veřejné, scraping se rozbíjí). ČSFD zůstává
jako cíl pro ruční proklik `linkUrl`, ne jako zdroj dat.

### 3.3 Flow pro uživatele

1. Uživatel ve formuláři zadá název a zvolí typ média.
2. Vedle názvu je tlačítko **„Najít info a obálku"** — zavolá se adaptér podle typu.
3. Zobrazí se mřížka 6–12 kandidátů (miniatura, název, rok, zdroj).
4. Kliknutím uživatel vybere hlavní obálku. Bonus: z téhož výsledku se nabídne
   **předvyplnění metadat** (rok, autor, počet stran, počet sérií, režisér…)
   — uživatel potvrdí nebo odmítne, nic se nepřepisuje bez souhlasu.
5. Obrázek se uloží: buď jen jako `external_url`, nebo se rovnou materializuje
   do Storage (viz 2.3). Neúspěšná hledání se logují do `image_search_results`
   (cache), aby se stejný dotaz neposílal opakovaně a šetřily se limity API.
6. Kdykoli později jde obálku změnit — znovu vyhledat, nahrát vlastní, vložit URL.

**Fallback řetězec:** API nic nenašlo → nabídnout obecné hledání (Google CSE,
pokud je nastaven klíč) → ruční URL → upload → placeholder s iniciálami
a barvou typu (zůstává z prototypu).

---

## 4. Podmíněné volby podle typu média

Jádrem je vazební tabulka M:N mezi platformami/formáty a typy médií:

```sql
create table media_type_platforms (
  media_type_id uuid references media_types(id) on delete cascade,
  platform_id   uuid references platforms(id) on delete cascade,
  primary key (media_type_id, platform_id)
);
```

**Chování v aplikaci:**

* Formulář po volbě typu „hra" nabídne v poli *Platforma* jen platformy
  navázané na typ hra — žádný ebook, žádná audiokniha.
* Jedna platforma smí patřit více typům: Netflix → film i seriál,
  YouTube → dokument, YouTube série i ostatní.
* V Nastavení má každá platforma multiselect „Zobrazovat u typů: ☑ film
  ☑ seriál ☐ hra…". Nová platforma se při založení rovnou přiřadí.
* Stejný princip platí pro **stavy** (kap. 7) a **vlastní pole** (kap. 9) —
  všechno v číselnících je vázané na typy médií stejným vzorem, takže se
  aplikace chová konzistentně a nastavení se snadno učí.

Změna typu u existující položky: pokud má položka platformu, která k novému
typu nepatří, hodnota se nezahodí, ale označí se ve formuláři varováním
(„PS5 není přiřazeno k typu Kniha — ponechat, změnit, nebo přiřadit?").

---

## 5. Rozšířený seznam typů médií

Výchozí sada (uživatelsky editovatelná, s možností přidat vlastní):

| Typ | Barva (návrh) | Výchozí zdroj metadat | Specifika |
|---|---|---|---|
| Film | červená | TMDb | režisér, délka, rok |
| Seriál | fialová | TMDb | série, epizody, „čekám na řadu" |
| Hra | tyrkysová | IGDB | platforma, obtížnost, 100 % |
| Kniha | zelená | Google Books + Open Library | autor, strany, citace |
| Audiokniha | tmavě zelená | Google Books | interpret/předčítá, délka |
| Komiks | oranžová | Comic Vine | scénárista, kreslíř, svazek |
| Manga | růžová | AniList | svazky, kapitoly, stav vydávání |
| Digitální komiks | oranžová (světlá) | Comic Vine | aplikace/služba |
| Desková hra | hnědá | BoardGameGeek | počet hráčů, délka partie |
| Podcast | žlutá | iTunes Search | epizody, feed |
| Dokument | šedomodrá | TMDb | — |
| Anime | světle fialová | AniList | série, epizody |
| YouTube série | červenošedá | — (ručně / CSE) | kanál, odkaz |
| Článek | šedá | — | URL, zdroj, autor |
| Kurz | modrá | — | platforma (Udemy…), lekce, certifikát |
| Ostatní | neutrální | — (CSE fallback) | volná pole |

Každý typ nese konfiguraci: **doporučená pole** (které skupiny polí formulář
zobrazí), **sadu stavů**, **sadu platforem** a **výchozí adaptér metadat**.
Uživatelem přidaný typ (třeba „LARP" nebo „Muzikál") začne s obecnými stavy
a poli a dá se doplnit v Nastavení.

Pozn.: *audiokniha* je v seznamu jako samostatný typ dle zadání, ale zároveň
existuje formát „audiokniha" u typu kniha. Doporučuji v UI preferovat
**kniha + formát audiokniha** (statistiky čtení zůstanou pohromadě) a
samostatný typ nechat pro lidi, kteří chtějí audioknihy vést odděleně — obojí
model umožňuje, je to jen otázka výchozích dat.

---

## 6. Rozšířený seznam platforem a formátů

Platformy dostávají volitelné **skupiny** (pro přehledné select boxy
s optgroup) a přiřazení k typům. Výchozí data:

### Hry (typ: hra; retro položky i typ „ostatní" pro sběratelství)

| Skupina | Platformy |
|---|---|
| PC | PC, Steam, Epic Games Store, GOG, handheld PC, Steam Deck |
| Xbox | Xbox, Xbox 360, Xbox One, Xbox Series X/S |
| PlayStation | PlayStation, PlayStation 2, PlayStation 3, PlayStation 4, PlayStation 5, PSP, PS Vita |
| Nintendo | Nintendo Switch, Nintendo Switch 2, Wii, Wii U, Nintendo DS, Nintendo 3DS, Game Boy, Game Boy Color, Game Boy Advance, Nintendo 64, GameCube, SNES, NES |
| Retro / ostatní | Sega Mega Drive, Dreamcast, retro konzole, emulace |
| Mobil | mobil, iOS, Android |
| Cloud | cloud gaming, GeForce Now, Xbox Cloud Gaming |

*Pozn.: „Steam/Epic/GOG" jsou obchody — v datech jsou to normální platformy
přiřazené k typu hra; kdo chce rozlišovat obchod a hardware, přidá si u hry
dvě hodnoty (model počítá s možností více platforem na položku, viz kap. 8).*

### Knihy (typ: kniha, audiokniha)

fyzická kniha · ebook · Kindle · audiokniha · PDF · online čtení ·
půjčeno · knihovna · vlastní výtisk

*(půjčeno / knihovna / vlastní výtisk jsou spíš „původ" než formát — v datech
je to jedna tabulka, v UI je lze zobrazit jako druhý select „Odkud", obojí
vázané na typ kniha.)*

### Komiksy a manga (typ: komiks, digitální komiks, manga)

fyzický komiks · digitální komiks · manga · sešit · svazek · omnibus ·
paperback · hardcover · online čtení · aplikace · vlastní sbírka

### Filmy a seriály (typ: film, seriál, dokument, anime)

kino · televize · Netflix · HBO Max / Max · Disney+ · Apple TV+ ·
Prime Video · SkyShowtime · YouTube · Blu-ray · DVD · vlastní soubor ·
stream · půjčeno · festival

*(YouTube navíc přiřazen k typům YouTube série a ostatní; kino a festival jen
k filmu a dokumentu.)*

### Podcasty a audio (typ: podcast, audiokniha)

Spotify · Apple Podcasts · YouTube Music · Pocket Casts · RSS ·
audioknižní aplikace

Všechna přiřazení jsou jen výchozí seed — uživatel je v Nastavení může
libovolně měnit, přidávat platformy a přepínat, u kterých typů se zobrazují.
Tím je splněn požadavek „doplnitelné podle toho, co přijde v budoucnu":
vyjde nová konzole nebo služba → jedna položka v Nastavení, žádný zásah do kódu.

---

## 7. Návrh stavů podle typu média

Doporučená (a preferovaná) **kombinace**: každý stav má **interní význam**
(pevný, strojově čitelný) a **veřejný label** (volný text podle typu média).

```sql
create table statuses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  media_type_id uuid references media_types(id),  -- NULL = globální stav
  meaning       text not null,
    -- 'wishlist' | 'owned' | 'in_progress' | 'completed' | 'completed_100'
    -- | 'paused' | 'dropped' | 'repeating' | 'waiting' | 'ongoing' | 'archived'
  label         text not null,
  color         text,
  sort          int not null default 0
);
```

**Proč dvouvrstvě:** interní `meaning` drží statistiky a filtry pohromadě
napříč typy — „letos dokončeno: 47" sečte *dohráno*, *přečteno*, *viděno*
i *dokoukáno*, protože všechny mají `meaning = completed`. Label přitom mluví
jazykem daného média.

**Výchozí mapování** (seed, plně editovatelné):

| meaning | globální | hra | kniha | film | seriál | komiks |
|---|---|---|---|---|---|---|
| wishlist | chci zkusit / plánuji | chci zahrát | chci číst | chci vidět | chci sledovat | chci číst |
| owned | koupeno / vlastním | koupeno · v backlogu | koupeno | — | — | sbírám |
| in_progress | právě konzumuji / rozpracováno | rozehráno | rozečteno · poslouchám jako audioknihu | — | sleduji | rozečteno |
| completed | dokončeno | dohráno | přečteno | viděno | dokoukáno | přečteno |
| completed_100 | — | dohráno na 100 % | — | — | — | — |
| paused | odloženo | odloženo | odloženo | odloženo | — | odloženo |
| dropped | opuštěno | opuštěno | nedočteno | nedokoukáno | opuštěno | nedočteno |
| repeating | znovu | rozehráno znovu | čtu znovu | rewatch | rewatch | — |
| waiting | — | — | — | — | čekám na další sérii | čekám na další díl/svazek |
| ongoing | — | multiplayer / průběžně hraji | — | — | — | — |
| archived | archivováno | — | — | — | — | — |

Pravidlo řešení: pro položku se nabídnou stavy s `media_type_id` daného typu;
pokud pro nějaký `meaning` neexistuje typový stav, spadne se na globální.
U stavu jde v Nastavení určit typy, význam, label, barvu i pořadí — přesně
podle bodu 8 zadání.

Praktický bonus: `meaning = completed | completed_100` automaticky nabídne
vyplnění data dokončení; `repeating` umožní přidat **další záznam průchodu**
(rewatch/replay se ukládá jako nový interval dat, historie průchodů zůstává).

---

## 8. Chytřejší formulář pro přidání položky

Formulář se skládá ze tří vrstev:

1. **Společné jádro** (vždy): název, typ, stav, hodnocení, hlavní obrázek,
   odkaz(y) na databáze, poznámky/recenze, tagy, žánry, datum začátku a konce.
2. **Typové skupiny polí** (podle konfigurace typu):

   * **Hra:** platforma (více hodnot — např. Steam + Steam Deck),
     obchod/služba, stav hraní, obtížnost, herní mód (kampaň / co-op /
     multiplayer), číslo playthrough, délka hraní (h), achievementy / 100 %.
   * **Kniha:** formát, odkud (vlastní / knihovna / půjčeno), autor,
     překladatel, nakladatelství, počet stran, jazyk, citace (samostatné
     textové pole s možností více citací), recenze.
   * **Seriál:** služba, počet sérií, poslední zhlédnutá epizoda (S02E07),
     přepínač „čekám na další řadu", počítadlo rewatch.
   * **Film:** služba/kino, režisér, délka, rok.
   * **Komiks / manga:** fyzický × digitální, série, číslo svazku, číslo
     sešitu, scénárista, kreslíř, vydavatel, stav sbírky odděleně od stavu
     čtení (sbírám vs. rozečteno).
3. **Vlastní pole** uživatele pro daný typ (kap. 9).

**Chování:** změna typu média překreslí sekce 2 a 3 bez ztráty už vyplněných
společných polí. Pole „Najít info a obálku" (kap. 3.3) předvyplní, co umí
adaptér daného typu. Povinný je jen název a typ — všechno ostatní je volitelné,
aby rychlé přidání „chci zahrát" trvalo pět sekund, ale detailní záznam
o dočtené knize mohl mít citace i recenzi.

Technicky: konfigurace `media_types.field_groups` (jsonb) říká, které skupiny
se renderují; samotné definice polí typových skupin jsou uložené jako výchozí
záznamy v `custom_fields` (viz níže) — **typová pole a vlastní pole jsou jeden
mechanismus**, jen typová jsou předvytvořená. Nic není zadrátované v kódu.

---

## 9. Vlastní pole podle typu média

```sql
create table custom_fields (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id),
  media_type_id uuid references media_types(id) on delete cascade,
  name          text not null,           -- 'Obtížnost'
  field_type    text not null,           -- 'text' | 'number' | 'boolean'
                                         -- | 'select' | 'multiselect' | 'date'
  options       jsonb,                   -- pro select: ["Easy","Normal","Hard"]
  is_default    boolean default false,   -- systémem předvytvořené typové pole
  sort          int default 0
);

create table custom_field_values (
  item_id  uuid references items(id) on delete cascade,
  field_id uuid references custom_fields(id) on delete cascade,
  value    jsonb not null,
  primary key (item_id, field_id)
);
```

Hodnota v `jsonb` pokryje všechny typy polí jednotně (`"Hard"`, `342`, `true`,
`["co-op","kampaň"]`, `"2026-03-01"`). Výchozí sada (seed) odpovídá zadání:

* hra: obtížnost (select), herní mód (multiselect), dohráno na 100 % (boolean),
  délka hraní (number, h), achievementy (text/number),
* kniha: počet stran (number), autor, překladatel, vydání, jazyk (text/select),
* komiks: scénárista, kreslíř, série, číslo svazku, vydavatel,
* seriál: série (number), epizody (number), poslední zhlédnutá epizoda (text),
* film: režisér, délka (number, min), rok (number), kino/stream (select).

V Nastavení jde přidat pole komukoli k čemukoli („Kurz → certifikát: boolean",
„Deskovka → počet hráčů: number") a určit pořadí ve formuláři. Filtrování
a řazení podle vlastních polí je možné (jsonb indexy), ale patří až do
pozdější fáze (kap. 12).

---

## 10. Doplněný databázový model

Přehled celého schématu a smysl jednotlivých tabulek:

**Jádro**

* `items` — položky knihovny: id, user_id, title, media_type_id, status_id,
  rating (0–10), start_date, end_date, notes, created_at. Vazby na všechno
  ostatní.
* `media_types` — číselník typů: name, color, icon, field_groups (jsonb),
  default_adapter (jaké API použít), sort.
* `platforms` — číselník platforem/formátů: name, group_name, sort.
* `statuses` — stavy s meaning/label/color/sort (kap. 7).
* `genres`, `tags` + vazební `item_genres`, `item_tags` — žánry (řízený
  číselník) a volné tagy (folksonomie), obojí M:N.
* `links` — externí odkazy položky: item_id, kind (`csfd | imdb | backloggd |
  databazeknih | jiné`), url. Víc odkazů na položku (ČSFD *i* IMDb),
  `kind` řídí ikonku; typy odkazů jsou vlastní malý číselník v Nastavení.
* `playthroughs` — průchody: item_id, start_date, end_date, note. První
  průchod se dubluje do items pro rychlé řazení; rewatch/replay přidává řádky.

**Nové tabulky z tohoto zadání a proč**

* `media_type_platforms` (M:N) — bez ní nejde platforma přiřadit více typům
  a formulář by neuměl podmíněné nabídky (kap. 4). Alternativa „sloupec
  media_type_id v platforms" by nutila duplikovat Netflix pro film i seriál.
* `media_type_statuses` — v návrhu řešeno elegantněji sloupcem
  `statuses.media_type_id` (NULL = globální). Samostatná M:N tabulka by dávala
  smysl, kdyby *tentýž* stav měl platit pro víc typů se stejným labelem —
  to model také unese (řádek pro každý typ), ale typové labely se stejně liší,
  takže sloupec stačí a dotazy jsou jednodušší.
* `custom_fields` + `custom_field_values` — rozšiřitelnost bez migrací schématu
  (kap. 9). Values jsou oddělené od items, aby položka zůstala štíhlá a pole
  šla přidávat/mazat bez dotyku hlavní tabulky.
* `images` — víc obrázků s rolemi a hlavní obálkou (kap. 2). Souvisí s items
  1:N; `is_primary` s partial unique indexem hlídá konzistenci.
* `image_search_results` — cache odpovědí adaptérů: query, media_type,
  source, results (jsonb), fetched_at. Důvod: limity API (Comic Vine 200/hod,
  Google CSE 100/den) a rychlost — opakované hledání téhož titulu jde z cache.
  TTL ~30 dní, pak refresh.
* `user_settings` — key–value (jsonb) nastavení uživatele: výchozí typ,
  řazení, vzhled, chování materializace obrázků, zapnuté adaptéry.
* `external_source_adapters` — konfigurace zdrojů metadat: name (`tmdb`,
  `igdb`…), enabled, per-user API klíč (pokud si uživatel přináší vlastní),
  mapping na typy médií. **Klíče nikdy v plaintextu v klientovi**: ukládat
  šifrovaně (Supabase Vault / pgsodium) a používat jen v Edge Functions.
  Provozně jednodušší varianta pro osobní aplikaci: klíče vůbec nedávat do DB
  a držet je v Supabase secrets — tabulka pak řeší jen zapnuto/vypnuto
  a mapování zdroj → typ.

**Jak to drží pohromadě:** items je střed; typ položky určuje přes
`media_type_platforms`, `statuses.media_type_id` a `custom_fields.media_type_id`,
co formulář nabídne; `images` a `links` věší na položku vizuál a prokliky;
`external_source_adapters` + Edge Function plní `images`
a `custom_field_values` daty z API; RLS na všech tabulkách filtruje podle
`user_id`, takže model je od prvního dne připravený i na víc uživatelů.

---

## 11. Doporučené MVP po těchto změnách

Cíl MVP: plně použitelná osobní knihovna s obrázky a podmíněným formulářem.
Pořadí je zvolené tak, aby každý krok šel reálně používat:

1. **Základ:** Next.js + Supabase projekt, Auth (e-mail magic link), schéma
   z kap. 10 se seed daty (typy, platformy, stavy vč. mapování na typy),
   RLS politiky.
2. **CRUD položek + knihovna:** grid s obálkami, detail, filtrování podle
   typu/stavu/tagů, hledání, řazení — přenést z prototypu na novou datovou vrstvu.
3. **Podmíněný formulář:** společné jádro + typové skupiny polí čtené
   z `custom_fields` (zatím bez UI na tvorbu vlastních polí — jen výchozí sada).
4. **Obrázky, fáze 1:** upload ze zařízení (s klientskou kompresí), ruční URL,
   hlavní obálka, smazání, placeholder. Jeden bucket, RLS.
5. **Automatické obálky, fáze 1:** Edge Function `search-covers` se dvěma
   nejsnazšími adaptéry — **TMDb** (film/seriál/dokument) a **Google Books +
   Open Library** (knihy). Pokryje to většinu položek při minimu byrokracie
   s klíči. Výběrová mřížka + uložení URL.
6. **Nastavení, fáze 1:** správa typů, platforem (vč. přiřazení k typům)
   a stavů (label, barva, pořadí, typ). Export/import JSON.
7. **IGDB adaptér** pro hry (vyžaduje Twitch OAuth v Edge Function — o krok
   složitější, proto po TMDb) + předvyplňování metadat z výsledků.

Tím je splněné všechno podstatné ze zadání. Odhadem jde o 6–8 ucelených
pracovních bloků; každý bod je samostatně nasaditelný.

## 12. Co je vhodné nechat až do pozdější fáze

* **Comic Vine, AniList, BGG a iTunes adaptéry** — přidávat po jednom podle
  toho, co reálně evidujete nejvíc; architektura adaptérů je na to připravená.
* **Google Custom Search fallback** — až po ověření, že specializované zdroje
  nestačí (denní limit 100 dotazů ho stejně odsouvá do role poslední záchrany).
* **UI editor vlastních polí** — výchozí sada pokryje 90 % potřeb; builder
  polí (typ, options, pořadí) je práce navíc s malým okamžitým přínosem.
* **Materializace externích obrázků + úklid sirotků ve Storage** — nejdřív
  hotlinky, kopírování do Storage přidat, až se ukáže hniloba odkazů.
* **Galerie více obrázků a screenshoty** — MVP stačí hlavní obálka + možnost
  ji vyměnit; role `screenshot`/`photo`/`background` model už umí, UI později.
* **Playthroughs / historie průchodů** — v MVP stačí jeden interval dat;
  rewatch historie až po zaběhnutí stavů.
* **Statistiky a přehledy** (dokončeno za rok podle typů, průměrná hodnocení,
  grafy) — datový model to díky `meaning` u stavů umí od začátku, vizualizace
  ale není blokující.
* **Filtrování podle vlastních polí, hromadné úpravy, import z Goodreads /
  Trakt / HowLongToBeat, PWA/offline režim, sdílení knihovny** — nice-to-have
  vrstva až po stabilním jádru.

---

### Poznámka k realizaci

Tento rozsah už přesahuje možnosti interaktivního prototypu v chatu (bezpečné
API klíče, Storage a Auth vyžadují vlastní backend). Doporučený postup: založit
Supabase projekt (free tier na tohle stačí s velkou rezervou), vygenerovat
schéma z kap. 10 jako první migraci a stavět podle pořadí v kap. 11.
