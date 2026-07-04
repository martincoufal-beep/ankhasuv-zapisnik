-- ============================================================================
-- Metadata z API do polí položky + úklid kategorií.
--   1) custom_fields.source_key — stabilní klíč pro mapování z adaptérů
--      (adaptér vrátí {director, author, year, ...}, pole se najde přes source_key).
--   2) Odebrání kategorií podcast / článek / YouTube série (0 položek → bezpečné).
--   3) Čistý reseed výchozích polí podle kategorií, se source_key.
-- Pozn.: výchozí (user_id NULL) položky se dají mazat a reseedovat, protože
-- v DB zatím nejsou žádné položky (custom_field_values by kaskádovaly).
-- ============================================================================

alter table custom_fields add column if not exists source_key text;

-- ---- 2) Odebrat nechtěné kategorie (kaskáda smaže jejich pole/stavy/vazby) ----
delete from media_types
 where user_id is null and slug in ('podcast', 'clanek', 'youtube-serie');

-- itunes adaptér (podcasty) už není potřeba
delete from external_source_adapters where user_id is null and name = 'itunes';

-- ---- 3) Reseed výchozích polí (jen systémové, user_id NULL) -------------------
delete from custom_fields where user_id is null;

-- Pomocná funkce zápisu polí pro daný slug typu
create or replace function seed_fields(
  p_slug text,
  p_fields jsonb  -- pole objektů {name, ft, opts, key, sort}
) returns void language plpgsql as $$
declare mt uuid; f jsonb;
begin
  select id into mt from media_types where slug = p_slug and user_id is null;
  if mt is null then return; end if;
  for f in select * from jsonb_array_elements(p_fields) loop
    insert into custom_fields (media_type_id, name, field_type, options, is_default, source_key, sort)
    values (
      mt,
      f->>'name',
      f->>'ft',
      case when f ? 'opts' then f->'opts' else null end,
      true,
      f->>'key',
      (f->>'sort')::int
    );
  end loop;
end $$;

-- Film
select seed_fields('film', '[
  {"name":"Režisér","ft":"text","key":"director","sort":10},
  {"name":"Délka (min)","ft":"number","key":"runtime","sort":20},
  {"name":"Rok","ft":"number","key":"year","sort":30}
]');

-- Dokument
select seed_fields('dokument', '[
  {"name":"Režisér","ft":"text","key":"director","sort":10},
  {"name":"Délka (min)","ft":"number","key":"runtime","sort":20},
  {"name":"Rok","ft":"number","key":"year","sort":30}
]');

-- Seriál
select seed_fields('serial', '[
  {"name":"Tvůrce","ft":"text","key":"creator","sort":10},
  {"name":"Počet sérií","ft":"number","key":"seasons","sort":20},
  {"name":"Počet epizod","ft":"number","key":"episodes","sort":30},
  {"name":"Rok","ft":"number","key":"year","sort":40},
  {"name":"Stav vydávání","ft":"text","key":"status","sort":50},
  {"name":"Poslední zhlédnutá epizoda","ft":"text","sort":60}
]');

-- Anime
select seed_fields('anime', '[
  {"name":"Studio","ft":"text","key":"studio","sort":10},
  {"name":"Počet epizod","ft":"number","key":"episodes","sort":20},
  {"name":"Rok","ft":"number","key":"year","sort":30},
  {"name":"Stav vydávání","ft":"text","key":"status","sort":40}
]');

-- Kniha
select seed_fields('kniha', '[
  {"name":"Autor","ft":"text","key":"author","sort":10},
  {"name":"Nakladatelství","ft":"text","key":"publisher","sort":20},
  {"name":"Počet stran","ft":"number","key":"pages","sort":30},
  {"name":"Rok vydání","ft":"number","key":"year","sort":40},
  {"name":"Jazyk","ft":"text","key":"language","sort":50},
  {"name":"ISBN","ft":"text","key":"isbn","sort":60},
  {"name":"Překladatel","ft":"text","sort":70},
  {"name":"Citace","ft":"text","sort":80}
]');

-- Audiokniha
select seed_fields('audiokniha', '[
  {"name":"Autor","ft":"text","key":"author","sort":10},
  {"name":"Interpret","ft":"text","sort":15},
  {"name":"Nakladatelství","ft":"text","key":"publisher","sort":20},
  {"name":"Rok vydání","ft":"number","key":"year","sort":30},
  {"name":"Jazyk","ft":"text","key":"language","sort":40}
]');

-- Komiks
select seed_fields('komiks', '[
  {"name":"Scénárista","ft":"text","key":"writer","sort":10},
  {"name":"Kreslíř","ft":"text","key":"artist","sort":20},
  {"name":"Vydavatel","ft":"text","key":"publisher","sort":30},
  {"name":"Série","ft":"text","key":"series","sort":40},
  {"name":"Číslo sešitu","ft":"number","key":"issue","sort":50},
  {"name":"Rok vydání","ft":"number","key":"year","sort":60}
]');

-- Digitální komiks
select seed_fields('digitalni-komiks', '[
  {"name":"Scénárista","ft":"text","key":"writer","sort":10},
  {"name":"Kreslíř","ft":"text","key":"artist","sort":20},
  {"name":"Vydavatel","ft":"text","key":"publisher","sort":30},
  {"name":"Série","ft":"text","key":"series","sort":40},
  {"name":"Číslo sešitu","ft":"number","key":"issue","sort":50},
  {"name":"Rok vydání","ft":"number","key":"year","sort":60}
]');

-- Manga
select seed_fields('manga', '[
  {"name":"Autor","ft":"text","key":"author","sort":10},
  {"name":"Vydavatel","ft":"text","key":"publisher","sort":20},
  {"name":"Počet svazků","ft":"number","key":"volumes","sort":30},
  {"name":"Počet kapitol","ft":"number","key":"chapters","sort":40},
  {"name":"Rok vydání","ft":"number","key":"year","sort":50},
  {"name":"Stav vydávání","ft":"text","key":"status","sort":60}
]');

-- Hra
select seed_fields('hra', '[
  {"name":"Vývojář","ft":"text","key":"developer","sort":10},
  {"name":"Vydavatel","ft":"text","key":"publisher","sort":20},
  {"name":"Herní módy","ft":"text","key":"modes","sort":30},
  {"name":"Rok vydání","ft":"number","key":"year","sort":40},
  {"name":"Obtížnost","ft":"select","opts":["Easy","Normal","Hard","Velmi těžká","Vlastní"],"sort":50},
  {"name":"Dohráno na 100 %","ft":"boolean","sort":60},
  {"name":"Délka hraní (h)","ft":"number","sort":70},
  {"name":"Achievementy","ft":"text","sort":80}
]');

-- Desková hra
select seed_fields('deskova-hra', '[
  {"name":"Autor (designer)","ft":"text","key":"designer","sort":10},
  {"name":"Počet hráčů","ft":"text","key":"players","sort":20},
  {"name":"Délka partie (min)","ft":"number","key":"playtime","sort":30},
  {"name":"Rok vydání","ft":"number","key":"year","sort":40}
]');

-- Kurz (bez API — ruční)
select seed_fields('kurz', '[
  {"name":"Platforma kurzu","ft":"text","sort":10},
  {"name":"Počet lekcí","ft":"number","sort":20},
  {"name":"Certifikát","ft":"boolean","sort":30}
]');

drop function seed_fields(text, jsonb);
