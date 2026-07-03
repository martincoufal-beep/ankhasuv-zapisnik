-- ============================================================================
-- Vazba položka ↔ platforma (M:N).
-- Kapitola 8 návrhu: platforma může mít u položky více hodnot (Steam + Steam
-- Deck). V 0001_init chyběla tabulka, kam volbu uložit — items sloupec nemá.
-- RLS: vzor C (vlastnictví přes items), stejně jako item_tags / item_genres.
-- ============================================================================

create table item_platforms (
  item_id     uuid not null references items(id)     on delete cascade,
  platform_id uuid not null references platforms(id) on delete cascade,
  primary key (item_id, platform_id)
);

create index item_platforms_item_idx on item_platforms(item_id);

alter table item_platforms enable row level security;

create policy "item_platforms_all" on item_platforms for all to authenticated
  using (exists (select 1 from items i
                 where i.id = item_platforms.item_id and i.user_id = auth.uid()))
  with check (exists (select 1 from items i
                      where i.id = item_platforms.item_id and i.user_id = auth.uid()));
