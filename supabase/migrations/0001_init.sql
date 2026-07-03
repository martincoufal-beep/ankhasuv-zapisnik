-- ============================================================================
-- REGÁL — inicializační skript pro Supabase
-- Soubor: supabase/migrations/0001_init.sql
--
-- Jak spustit: Supabase dashboard → SQL Editor → New query →
-- vložit CELÝ tento soubor → Run. Skript je idempotentní jen částečně,
-- počítá se s jedním spuštěním na čistém projektu.
--
-- Obsah:
--   1) Tabulky (kapitola 10 návrhu)
--   2) Indexy
--   3) Row Level Security (každý uživatel vidí jen svá data;
--      výchozí číselníky mají user_id NULL a jsou jen ke čtení)
--   4) Seed: typy médií, platformy + vazby, stavy, žánry,
--      výchozí vlastní pole, adaptéry metadat
--   5) Storage bucket "covers" + politiky
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1) TABULKY
-- ============================================================================

-- ---- Typy médií ------------------------------------------------------------
create table media_types (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade, -- NULL = výchozí (systémový) záznam
  slug            text not null unique,       -- stabilní klíč pro kód a seedy
  name            text not null,
  color           text not null default '#8B8FA3',
  icon            text,
  field_groups    jsonb not null default '[]'::jsonb, -- které skupiny polí formulář zobrazí
  default_adapter text,                       -- 'tmdb' | 'igdb' | 'googlebooks' | ...
  sort            int  not null default 0
);

-- ---- Platformy / formáty ----------------------------------------------------
create table platforms (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  name       text not null,
  group_name text,                            -- 'PlayStation', 'Streaming', ...
  sort       int  not null default 0
);

create table media_type_platforms (
  media_type_id uuid not null references media_types(id) on delete cascade,
  platform_id   uuid not null references platforms(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade, -- NULL = výchozí vazba
  primary key (media_type_id, platform_id)
);

-- ---- Stavy (interní význam + label podle typu) ------------------------------
create table statuses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  media_type_id uuid references media_types(id) on delete cascade, -- NULL = globální stav
  meaning       text not null check (meaning in (
                  'wishlist','owned','in_progress','completed','completed_100',
                  'paused','dropped','repeating','waiting','ongoing','archived')),
  label         text not null,
  color         text,
  sort          int  not null default 0
);

-- ---- Žánry a tagy ------------------------------------------------------------
create table genres (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name    text not null
);

create table tags (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name    text not null,
  unique (user_id, name)
);

-- ---- Položky knihovny ---------------------------------------------------------
create table items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  title         text not null,
  media_type_id uuid not null references media_types(id),
  status_id     uuid references statuses(id) on delete set null,
  rating        int  check (rating between 0 and 10), -- 0–10 = 5 hvězd s polovinami
  start_date    date,
  end_date      date,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table item_genres (
  item_id  uuid not null references items(id)  on delete cascade,
  genre_id uuid not null references genres(id) on delete cascade,
  primary key (item_id, genre_id)
);

create table item_tags (
  item_id uuid not null references items(id) on delete cascade,
  tag_id  uuid not null references tags(id)  on delete cascade,
  primary key (item_id, tag_id)
);

-- ---- Externí odkazy (ČSFD, IMDb, Backloggd…) ---------------------------------
create table links (
  id      uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  kind    text not null default 'other',  -- 'csfd' | 'imdb' | 'backloggd' | 'databazeknih' | 'other'
  url     text not null
);

-- ---- Obrázky -------------------------------------------------------------------
create table images (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references items(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  kind         text not null default 'cover'
               check (kind in ('cover','alt_cover','screenshot','photo','background')),
  source       text not null check (source in ('upload','url','api')),
  storage_path text,
  external_url text,
  source_name  text,                      -- 'tmdb' | 'igdb' | 'openlibrary' | ...
  is_primary   boolean not null default false,
  width        int,
  height       int,
  created_at   timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create unique index one_primary_per_item on images(item_id) where is_primary;

-- ---- Průchody (rewatch / replay) -----------------------------------------------
create table playthroughs (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references items(id) on delete cascade,
  start_date date,
  end_date   date,
  note       text,
  created_at timestamptz not null default now()
);

-- ---- Vlastní pole ----------------------------------------------------------------
create table custom_fields (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade, -- NULL = výchozí typové pole
  media_type_id uuid not null references media_types(id) on delete cascade,
  name          text not null,
  field_type    text not null check (field_type in
                  ('text','number','boolean','select','multiselect','date')),
  options       jsonb,                   -- pro select/multiselect: ["Easy","Normal","Hard"]
  is_default    boolean not null default false,
  sort          int not null default 0
);

create table custom_field_values (
  item_id  uuid not null references items(id)         on delete cascade,
  field_id uuid not null references custom_fields(id) on delete cascade,
  value    jsonb not null,
  primary key (item_id, field_id)
);

-- ---- Nastavení uživatele -----------------------------------------------------------
create table user_settings (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
);

-- ---- Cache výsledků hledání obálek ---------------------------------------------------
create table image_search_results (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  query           text not null,
  media_type_slug text not null,
  source          text not null,
  results         jsonb not null,
  fetched_at      timestamptz not null default now()
);

-- ---- Konfigurace zdrojů metadat --------------------------------------------------------
-- API klíče sem NEPATŘÍ — ty žijí v Supabase secrets (Edge Functions).
create table external_source_adapters (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- NULL = výchozí konfigurace
  name    text not null,                  -- 'tmdb' | 'igdb' | ...
  enabled boolean not null default true,
  config  jsonb not null default '{}'::jsonb
);

-- ============================================================================
-- 2) INDEXY
-- ============================================================================

create index items_user_idx        on items(user_id);
create index items_type_idx        on items(media_type_id);
create index items_status_idx      on items(status_id);
create index images_item_idx       on images(item_id);
create index links_item_idx        on links(item_id);
create index playthroughs_item_idx on playthroughs(item_id);
create index cfv_item_idx          on custom_field_values(item_id);
create index isr_lookup_idx        on image_search_results(query, media_type_slug, source);

-- updated_at u položek
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger items_updated_at before update on items
for each row execute function set_updated_at();

-- ============================================================================
-- 3) ROW LEVEL SECURITY
-- Vzor A (číselníky): číst smí každý přihlášený výchozí řádky (user_id NULL)
--   + své vlastní; zapisovat/měnit/mazat jen své vlastní.
-- Vzor B (uživatelská data): všechno jen vlastník.
-- Vzor C (tabulky navázané na items): vlastnictví se ověřuje přes items.
-- ============================================================================

-- ---- Vzor A: číselníky --------------------------------------------------------
alter table media_types              enable row level security;
alter table platforms                enable row level security;
alter table media_type_platforms     enable row level security;
alter table statuses                 enable row level security;
alter table genres                   enable row level security;
alter table custom_fields            enable row level security;
alter table external_source_adapters enable row level security;

do $$
declare t text;
begin
  foreach t in array array['media_types','platforms','media_type_platforms',
                           'statuses','genres','custom_fields','external_source_adapters']
  loop
    execute format(
      'create policy "%1$s_select" on %1$I for select to authenticated
         using (user_id is null or user_id = auth.uid())', t);
    execute format(
      'create policy "%1$s_insert" on %1$I for insert to authenticated
         with check (user_id = auth.uid())', t);
    execute format(
      'create policy "%1$s_update" on %1$I for update to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create policy "%1$s_delete" on %1$I for delete to authenticated
         using (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---- Vzor B: čistě uživatelská data ---------------------------------------------
alter table items                enable row level security;
alter table tags                 enable row level security;
alter table images               enable row level security;
alter table user_settings        enable row level security;
alter table image_search_results enable row level security;

do $$
declare t text;
begin
  foreach t in array array['items','tags','images','user_settings','image_search_results']
  loop
    execute format(
      'create policy "%1$s_all" on %1$I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---- Vzor C: tabulky vázané na items ----------------------------------------------
alter table item_genres         enable row level security;
alter table item_tags           enable row level security;
alter table links               enable row level security;
alter table playthroughs        enable row level security;
alter table custom_field_values enable row level security;

do $$
declare t text;
begin
  foreach t in array array['item_genres','item_tags','links','playthroughs','custom_field_values']
  loop
    execute format(
      'create policy "%1$s_all" on %1$I for all to authenticated
         using (exists (select 1 from items i where i.id = %1$I.item_id and i.user_id = auth.uid()))
         with check (exists (select 1 from items i where i.id = %1$I.item_id and i.user_id = auth.uid()))', t);
  end loop;
end $$;

-- ============================================================================
-- 4) SEED DATA (výchozí číselníky, user_id = NULL)
-- ============================================================================

-- ---- 4.1 Typy médií ------------------------------------------------------------
insert into media_types (slug, name, color, field_groups, default_adapter, sort) values
  ('film',             'Film',             '#E06C5B', '["film"]',   'tmdb',        10),
  ('serial',           'Seriál',           '#9B7FD4', '["serial"]', 'tmdb',        20),
  ('hra',              'Hra',              '#4FB8A8', '["hra"]',    'igdb',        30),
  ('kniha',            'Kniha',            '#7FA85C', '["kniha"]',  'googlebooks', 40),
  ('audiokniha',       'Audiokniha',       '#5C8A50', '["kniha"]',  'googlebooks', 50),
  ('komiks',           'Komiks',           '#E8A33D', '["komiks"]', 'comicvine',   60),
  ('manga',            'Manga',            '#D678A8', '["komiks"]', 'anilist',     70),
  ('digitalni-komiks', 'Digitální komiks', '#EFBE6E', '["komiks"]', 'comicvine',   80),
  ('deskova-hra',      'Desková hra',      '#A9805B', '[]',         'bgg',         90),
  ('podcast',          'Podcast',          '#D9C25A', '[]',         'itunes',     100),
  ('dokument',         'Dokument',         '#7E93AD', '["film"]',   'tmdb',       110),
  ('anime',            'Anime',            '#B79CE8', '["serial"]', 'anilist',    120),
  ('youtube-serie',    'YouTube série',    '#C46A6A', '[]',         null,         130),
  ('clanek',           'Článek',           '#9A9DAC', '[]',         null,         140),
  ('kurz',             'Kurz',             '#5B8DD4', '[]',         null,         150),
  ('ostatni',          'Ostatní',          '#8B8FA3', '[]',         null,         160);

-- ---- 4.2 Platformy ---------------------------------------------------------------
insert into platforms (name, group_name, sort) values
  -- PC a obchody
  ('PC','PC',10),('Steam','PC',11),('Epic Games Store','PC',12),('GOG','PC',13),
  ('Steam Deck','PC',14),('handheld PC','PC',15),
  -- Xbox
  ('Xbox','Xbox',20),('Xbox 360','Xbox',21),('Xbox One','Xbox',22),('Xbox Series X/S','Xbox',23),
  -- PlayStation
  ('PlayStation','PlayStation',30),('PlayStation 2','PlayStation',31),('PlayStation 3','PlayStation',32),
  ('PlayStation 4','PlayStation',33),('PlayStation 5','PlayStation',34),('PSP','PlayStation',35),
  ('PS Vita','PlayStation',36),
  -- Nintendo
  ('Nintendo Switch','Nintendo',40),('Nintendo Switch 2','Nintendo',41),('Nintendo Wii','Nintendo',42),
  ('Nintendo Wii U','Nintendo',43),('Nintendo DS','Nintendo',44),('Nintendo 3DS','Nintendo',45),
  ('Game Boy','Nintendo',46),('Game Boy Color','Nintendo',47),('Game Boy Advance','Nintendo',48),
  ('Nintendo 64','Nintendo',49),('GameCube','Nintendo',50),('SNES','Nintendo',51),('NES','Nintendo',52),
  -- Retro / ostatní
  ('Sega Mega Drive','Retro',60),('Dreamcast','Retro',61),('retro konzole','Retro',62),('emulace','Retro',63),
  -- Mobil
  ('mobil','Mobil',70),('iOS','Mobil',71),('Android','Mobil',72),
  -- Cloud
  ('cloud gaming','Cloud',80),('GeForce Now','Cloud',81),('Xbox Cloud Gaming','Cloud',82),
  -- Knihy
  ('fyzická kniha','Knihy',100),('ebook','Knihy',101),('Kindle','Knihy',102),('audiokniha','Knihy',103),
  ('PDF','Knihy',104),('online čtení','Knihy',105),('půjčeno','Knihy',106),('knihovna','Knihy',107),
  ('vlastní výtisk','Knihy',108),
  -- Komiksy a manga
  ('fyzický komiks','Komiksy',120),('digitální komiks','Komiksy',121),('sešit','Komiksy',122),
  ('svazek','Komiksy',123),('omnibus','Komiksy',124),('paperback','Komiksy',125),
  ('hardcover','Komiksy',126),('aplikace','Komiksy',127),('vlastní sbírka','Komiksy',128),
  -- Filmy a seriály
  ('kino','Film a TV',140),('televize','Film a TV',141),('Netflix','Film a TV',142),
  ('HBO Max / Max','Film a TV',143),('Disney+','Film a TV',144),('Apple TV+','Film a TV',145),
  ('Prime Video','Film a TV',146),('SkyShowtime','Film a TV',147),('YouTube','Film a TV',148),
  ('Blu-ray','Film a TV',149),('DVD','Film a TV',150),('vlastní soubor','Film a TV',151),
  ('stream','Film a TV',152),('festival','Film a TV',153),
  -- Podcasty a audio
  ('Spotify','Audio',170),('Apple Podcasts','Audio',171),('YouTube Music','Audio',172),
  ('Pocket Casts','Audio',173),('RSS','Audio',174),('audioknižní aplikace','Audio',175);

-- ---- 4.3 Vazby platforma ↔ typ média -------------------------------------------------
-- Hry
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug = 'hra'
  and p.group_name in ('PC','Xbox','PlayStation','Nintendo','Retro','Mobil','Cloud');

-- Knihy + audioknihy
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug in ('kniha','audiokniha') and p.group_name = 'Knihy';

-- Komiks, manga, digitální komiks
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug in ('komiks','manga','digitalni-komiks')
  and (p.group_name = 'Komiksy' or p.name in ('online čtení','půjčeno','knihovna'));

-- Film, seriál, dokument, anime
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug in ('film','serial','dokument','anime') and p.group_name = 'Film a TV'
  and not (p.name in ('kino','festival') and mt.slug in ('serial','anime'));

-- Půjčeno i pro filmy (Blu-ray/DVD z půjčovny, knihovny)
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug in ('film','serial') and p.name = 'půjčeno'
on conflict do nothing;

-- Podcasty
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug = 'podcast' and p.group_name = 'Audio' and p.name <> 'audioknižní aplikace';

-- Audioknihy: audio aplikace
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug = 'audiokniha' and p.name in ('Spotify','audioknižní aplikace','YouTube Music')
on conflict do nothing;

-- YouTube série a ostatní: YouTube
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug in ('youtube-serie','ostatni') and p.name = 'YouTube'
on conflict do nothing;

-- Kurzy: online + YouTube + aplikace
insert into media_type_platforms (media_type_id, platform_id)
select mt.id, p.id from media_types mt, platforms p
where mt.slug = 'kurz' and p.name in ('YouTube','online čtení','aplikace','PC')
on conflict do nothing;

-- ---- 4.4 Stavy -------------------------------------------------------------------------
-- Globální (media_type_id NULL) — fallback pro typy bez vlastní sady
insert into statuses (media_type_id, meaning, label, sort) values
  (null,'wishlist',   'Plánuji',        10),
  (null,'owned',      'Vlastním',       20),
  (null,'in_progress','Rozpracováno',   30),
  (null,'completed',  'Dokončeno',      40),
  (null,'paused',     'Odloženo',       50),
  (null,'dropped',    'Opuštěno',       60),
  (null,'repeating',  'Znovu',          70),
  (null,'archived',   'Archivováno',    80);

-- Hry
insert into statuses (media_type_id, meaning, label, sort)
select mt.id, s.meaning, s.label, s.sort
from media_types mt,
(values
  ('wishlist','Chci zahrát',10),('owned','Koupeno',20),('owned','V backlogu',25),
  ('in_progress','Rozehráno',30),('completed','Dohráno',40),
  ('completed_100','Dohráno na 100 %',45),('paused','Odloženo',50),
  ('dropped','Opuštěno',60),('repeating','Rozehráno znovu',70),
  ('ongoing','Multiplayer / průběžně hraji',80)
) as s(meaning,label,sort)
where mt.slug = 'hra';

-- Knihy a audioknihy
insert into statuses (media_type_id, meaning, label, sort)
select mt.id, s.meaning, s.label, s.sort
from media_types mt,
(values
  ('wishlist','Chci číst',10),('owned','Koupeno',20),
  ('in_progress','Rozečteno',30),('in_progress','Poslouchám jako audioknihu',35),
  ('completed','Přečteno',40),('paused','Odloženo',50),
  ('dropped','Nedočteno',60),('repeating','Čtu znovu',70)
) as s(meaning,label,sort)
where mt.slug in ('kniha','audiokniha');

-- Filmy a dokumenty
insert into statuses (media_type_id, meaning, label, sort)
select mt.id, s.meaning, s.label, s.sort
from media_types mt,
(values
  ('wishlist','Chci vidět',10),('completed','Viděno',40),
  ('repeating','Rewatch',70),('paused','Odloženo',50),('dropped','Nedokoukáno',60)
) as s(meaning,label,sort)
where mt.slug in ('film','dokument');

-- Seriály a anime
insert into statuses (media_type_id, meaning, label, sort)
select mt.id, s.meaning, s.label, s.sort
from media_types mt,
(values
  ('wishlist','Chci sledovat',10),('in_progress','Sleduji',30),
  ('waiting','Čekám na další sérii',35),('completed','Dokoukáno',40),
  ('dropped','Opuštěno',60),('repeating','Rewatch',70)
) as s(meaning,label,sort)
where mt.slug in ('serial','anime');

-- Komiksy, manga, digitální komiksy
insert into statuses (media_type_id, meaning, label, sort)
select mt.id, s.meaning, s.label, s.sort
from media_types mt,
(values
  ('wishlist','Chci číst',10),('owned','Sbírám',20),
  ('in_progress','Rozečteno',30),('completed','Přečteno',40),
  ('paused','Odloženo',50),('dropped','Nedočteno',60),
  ('waiting','Čekám na další díl/svazek',70)
) as s(meaning,label,sort)
where mt.slug in ('komiks','manga','digitalni-komiks');

-- Barvy podle významu (jednotně napříč typy)
update statuses set color = case meaning
  when 'wishlist'      then '#8B9BB4'
  when 'owned'         then '#C2A75A'
  when 'in_progress'   then '#5B8DD4'
  when 'completed'     then '#6FA85C'
  when 'completed_100' then '#E8B54B'
  when 'paused'        then '#9A9DAC'
  when 'dropped'       then '#D46A5B'
  when 'repeating'     then '#9B7FD4'
  when 'waiting'       then '#4FB8A8'
  when 'ongoing'       then '#4F9BB8'
  when 'archived'      then '#6B6E7B'
end
where color is null;

-- ---- 4.5 Žánry (startovní sada) ----------------------------------------------------------
insert into genres (name) values
  ('Akce'),('Adventura'),('RPG'),('Strategie'),('Simulace'),
  ('Sci-fi'),('Fantasy'),('Horor'),('Thriller'),('Krimi'),
  ('Komedie'),('Drama'),('Romantika'),('Dokumentární'),
  ('Historický'),('Životopisný'),('Naučná literatura');

-- ---- 4.6 Výchozí vlastní pole podle typu -------------------------------------------------
-- Hra
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, f.options::jsonb, true, f.sort
from media_types mt,
(values
  ('Obtížnost','select','["Easy","Normal","Hard","Velmi těžká","Vlastní"]',10),
  ('Herní mód','multiselect','["Kampaň","Co-op","Multiplayer","Sandbox"]',20),
  ('Dohráno na 100 %','boolean',null,30),
  ('Délka hraní (h)','number',null,40),
  ('Achievementy','text',null,50)
) as f(name,field_type,options,sort)
where mt.slug = 'hra';

-- Kniha + audiokniha
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, null, true, f.sort
from media_types mt,
(values
  ('Autor','text',10),('Překladatel','text',20),('Nakladatelství','text',30),
  ('Počet stran','number',40),('Vydání','text',50),('Jazyk','text',60),
  ('Citace','text',70)
) as f(name,field_type,sort)
where mt.slug in ('kniha','audiokniha');

-- Komiks, manga, digitální komiks
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, null, true, f.sort
from media_types mt,
(values
  ('Scénárista','text',10),('Kreslíř','text',20),('Série','text',30),
  ('Číslo svazku','number',40),('Číslo sešitu','number',50),('Vydavatel','text',60)
) as f(name,field_type,sort)
where mt.slug in ('komiks','manga','digitalni-komiks');

-- Seriál + anime
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, null, true, f.sort
from media_types mt,
(values
  ('Počet sérií','number',10),('Počet epizod','number',20),
  ('Poslední zhlédnutá epizoda','text',30)
) as f(name,field_type,sort)
where mt.slug in ('serial','anime');

-- Film + dokument
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, null, true, f.sort
from media_types mt,
(values
  ('Režisér','text',10),('Délka (min)','number',20),('Rok','number',30)
) as f(name,field_type,sort)
where mt.slug in ('film','dokument');

-- Desková hra
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, null, true, f.sort
from media_types mt,
(values
  ('Počet hráčů','text',10),('Délka partie (min)','number',20)
) as f(name,field_type,sort)
where mt.slug = 'deskova-hra';

-- Kurz
insert into custom_fields (media_type_id, name, field_type, options, is_default, sort)
select mt.id, f.name, f.field_type, null, true, f.sort
from media_types mt,
(values
  ('Platforma kurzu','text',10),('Počet lekcí','number',20),('Certifikát','boolean',30)
) as f(name,field_type,sort)
where mt.slug = 'kurz';

-- ---- 4.7 Adaptéry metadat -------------------------------------------------------------------
insert into external_source_adapters (name, enabled, config) values
  ('tmdb',        true,  '{"types":["film","serial","dokument"]}'),
  ('igdb',        true,  '{"types":["hra"]}'),
  ('googlebooks', true,  '{"types":["kniha","audiokniha"]}'),
  ('openlibrary', true,  '{"types":["kniha","audiokniha"]}'),
  ('comicvine',   false, '{"types":["komiks","digitalni-komiks"]}'),
  ('anilist',     false, '{"types":["manga","anime"]}'),
  ('itunes',      false, '{"types":["podcast"]}'),
  ('bgg',         false, '{"types":["deskova-hra"]}'),
  ('google_cse',  false, '{"types":["ostatni","youtube-serie","clanek","kurz"]}');

-- ============================================================================
-- 5) STORAGE — bucket "covers" pro obrázky
-- Cesty souborů: {user_id}/{item_id}/{uuid}.webp
-- Bucket je public (čtení přes veřejné URL), zápis jen do vlastní složky.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "covers_public_read"
  on storage.objects for select
  using (bucket_id = 'covers');

create policy "covers_insert_own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers_update_own"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "covers_delete_own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- HOTOVO. Kontrola: v Table Editoru by mělo být 16 typů médií,
-- ~70 platforem, ~50 stavů a výchozí vlastní pole u typů.
-- ============================================================================
