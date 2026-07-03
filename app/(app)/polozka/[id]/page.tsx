import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  CustomField,
  Genre,
  ImageRow,
  ItemLink,
  ItemWithRelations,
  Platform,
  Tag,
} from "@/lib/types";
import { LINK_KIND_LABELS } from "@/lib/types";
import {
  formatDate,
  imageUrl,
  primaryImage,
  titleInitials,
} from "@/lib/helpers";
import { StarDisplay } from "@/components/StarRating";
import DeleteItemButton from "@/components/DeleteItemButton";
import ImageManager from "@/components/ImageManager";
import { Icon, TypeIcon } from "@/components/icons";

type ItemDetail = ItemWithRelations & {
  images: ImageRow[];
  item_platforms: { platform: Platform | null }[];
  item_genres: { genre: Genre | null }[];
  item_tags: { tag: Tag | null }[];
  links: ItemLink[];
  custom_field_values: { value: unknown; field: CustomField | null }[];
};

/** Barevné pilulky tagů/žánrů jako v mockupu — stabilní barva podle názvu. */
const TAG_COLORS = ["#4ADE80", "#60A5FA", "#C084FC", "#F0A33C", "#F472B6", "#2DD4BF"];
function tagColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return TAG_COLORS[h % TAG_COLORS.length];
}

function ColorPill({ label }: { label: string }) {
  const c = tagColor(label);
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `color-mix(in srgb, ${c} 15%, transparent)`,
        color: c,
      }}
    >
      {label}
    </span>
  );
}

function formatFieldValue(value: unknown, field: CustomField): string {
  if (field.field_type === "boolean") return value ? "ano" : "ne";
  if (field.field_type === "date") return formatDate(String(value)) ?? "—";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from("items")
    .select(
      `*,
       media_type:media_types(*),
       status:statuses(*),
       images(*),
       item_platforms(platform:platforms(*)),
       item_genres(genre:genres(*)),
       item_tags(tag:tags(*)),
       links(id, kind, url),
       custom_field_values(value, field:custom_fields(*))`
    )
    .eq("id", id)
    .maybeSingle();

  if (!data || !user) notFound();
  const item = data as unknown as ItemDetail;

  const color = item.media_type?.color ?? "#9CA3AF";
  const statusColor = item.status?.color ?? "#9CA3AF";
  const platforms = item.item_platforms
    .map((p) => p.platform)
    .filter((p): p is Platform => Boolean(p));
  const genres = item.item_genres
    .map((g) => g.genre)
    .filter((g): g is Genre => Boolean(g));
  const tags = item.item_tags
    .map((t) => t.tag)
    .filter((t): t is Tag => Boolean(t));
  const fieldValues = item.custom_field_values
    .filter((v) => v.field)
    .sort((a, b) => (a.field!.sort ?? 0) - (b.field!.sort ?? 0));

  const started = formatDate(item.start_date);
  const finished = formatDate(item.end_date);
  const cover = primaryImage(item.images);
  const coverSrc = cover ? imageUrl(cover) : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/knihovna"
        className="transition-quick text-sm font-medium text-muted hover:text-ink"
      >
        ← Zpět do knihovny
      </Link>

      {/* Hlavička */}
      <div className="mt-4 rounded-xl border border-line bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={`Obálka: ${item.title}`}
              className="h-52 w-[8.5rem] shrink-0 rounded-xl object-cover shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]"
            />
          ) : (
            <div
              className="flex h-52 w-[8.5rem] shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `linear-gradient(160deg, color-mix(in srgb, ${color} 24%, #17171A) 0%, #0B0B0D 70%)`,
              }}
              aria-hidden
            >
              <span
                className="text-3xl font-bold tracking-tight"
                style={{ color: `color-mix(in srgb, ${color} 70%, #F4F4F5)` }}
              >
                {titleInitials(item.title)}
              </span>
            </div>
          )}

          <div className="min-w-0">
            {item.status && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  backgroundColor: `color-mix(in srgb, ${statusColor} 18%, transparent)`,
                  color: statusColor,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: statusColor }}
                  aria-hidden
                />
                {item.status.label}
              </span>
            )}
            <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {item.title}
            </h1>

            <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
              <span className="flex items-center gap-1.5" style={{ color }}>
                <TypeIcon slug={item.media_type?.slug} size={14} />
                {item.media_type?.name}
              </span>
              {platforms.length > 0 && (
                <span>{platforms.map((p) => p.name).join(", ")}</span>
              )}
              {(started || finished) && (
                <span>
                  {started ?? "…"} — {finished ?? "…"}
                </span>
              )}
            </p>

            {item.rating !== null && (
              <div className="mt-4">
                <p className="text-xs font-medium text-muted">Moje hodnocení</p>
                <p className="mt-1 flex items-center gap-2">
                  <StarDisplay value={item.rating} size={17} />
                  <span className="text-sm font-semibold tabular-nums">
                    {(item.rating / 2).toLocaleString("cs-CZ")}/5
                  </span>
                </p>
              </div>
            )}

            <div className="mt-4">
              <Link
                href={`/polozka/${item.id}/upravit`}
                className="btn-accent inline-block rounded-lg px-4 py-2 text-sm"
              >
                Upravit
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Správa obrázků */}
      <ImageManager
        itemId={item.id}
        userId={user.id}
        itemTitle={item.title}
        typeSlug={item.media_type?.slug}
        initialImages={item.images ?? []}
      />

      {/* Typová a vlastní pole */}
      {fieldValues.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Podrobnosti</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-xl border border-line bg-card p-4 text-sm sm:grid-cols-2">
            {fieldValues.map(({ value, field }) => (
              <div key={field!.id} className="flex justify-between gap-4">
                <dt className="text-muted">{field!.name}</dt>
                <dd className="text-right font-medium">
                  {formatFieldValue(value, field!)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Poznámky / recenze */}
      {item.notes && (
        <section className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Moje recenze</h2>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink/90">
            {item.notes}
          </p>
        </section>
      )}

      {/* Žánry a tagy — barevné pilulky */}
      {(genres.length > 0 || tags.length > 0) && (
        <section className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Tagy</h2>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <ColorPill key={g.id} label={g.name} />
            ))}
            {tags.map((t) => (
              <ColorPill key={t.id} label={t.name} />
            ))}
          </div>
        </section>
      )}

      {/* Externí odkazy */}
      {item.links.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-bold tracking-tight">Odkazy</h2>
          <div className="mt-3 space-y-2">
            {item.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-quick flex items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 text-sm font-medium text-ink hover:border-brass/50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-panel text-muted">
                  <Icon name="external" size={13} />
                </span>
                {LINK_KIND_LABELS[l.kind] ?? "Odkaz"}
                <span className="ml-auto max-w-[50%] truncate text-xs font-normal text-muted">
                  {l.url.replace(/^https?:\/\//, "")}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Patička: datum + odebrání */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-xs text-muted/70">
          Zapsáno {formatDate(item.created_at)}
          {item.updated_at !== item.created_at &&
            ` · upraveno ${formatDate(item.updated_at)}`}
        </p>
        <DeleteItemButton itemId={item.id} title={item.title} />
      </div>
    </main>
  );
}
