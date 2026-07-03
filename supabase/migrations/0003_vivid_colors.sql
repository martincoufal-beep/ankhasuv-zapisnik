-- ============================================================================
-- Živější barvy výchozích číselníků pro nový vizuál (dashboard mockup):
-- syté odstíny stavů (zelená dokončeno, modrá rozpracováno…) a typů médií.
-- Mění jen výchozí řádky (user_id IS NULL); vlastní barvy uživatelů nechává.
-- ============================================================================

update statuses set color = case meaning
  when 'wishlist'      then '#A78BFA'
  when 'owned'         then '#FBBF24'
  when 'in_progress'   then '#60A5FA'
  when 'completed'     then '#4ADE80'
  when 'completed_100' then '#FACC15'
  when 'paused'        then '#9CA3AF'
  when 'dropped'       then '#F87171'
  when 'repeating'     then '#C084FC'
  when 'waiting'       then '#2DD4BF'
  when 'ongoing'       then '#38BDF8'
  when 'archived'      then '#71717A'
end
where user_id is null;

update media_types set color = c.color
from (values
  ('film',             '#F87171'),
  ('serial',           '#A78BFA'),
  ('hra',              '#2DD4BF'),
  ('kniha',            '#A3E635'),
  ('audiokniha',       '#84CC16'),
  ('komiks',           '#FBBF24'),
  ('manga',            '#F472B6'),
  ('digitalni-komiks', '#FCD34D'),
  ('deskova-hra',      '#E0995A'),
  ('podcast',          '#FACC15'),
  ('dokument',         '#94A3B8'),
  ('anime',            '#C4B5FD'),
  ('youtube-serie',    '#FB7185'),
  ('clanek',           '#A1A1AA'),
  ('kurz',             '#60A5FA'),
  ('ostatni',          '#9CA3AF')
) as c(slug, color)
where media_types.slug = c.slug and media_types.user_id is null;
