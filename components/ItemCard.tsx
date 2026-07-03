import Link from "next/link";
import type { ItemWithRelations } from "@/lib/types";
import { formatDate, imageUrl, primaryImage, titleInitials } from "@/lib/helpers";
import { StarDisplay } from "./StarRating";
import { TypeIcon } from "./icons";

/**
 * Karta v mřížce (mockup): obálka se status pilulkou s tečkou, pod ní tučný
 * titulek, typ, hvězdičky s číslem a řádek platforma · datum.
 */
export default function ItemCard({ item }: { item: ItemWithRelations }) {
  const color = item.media_type?.color ?? "#9CA3AF";
  const cover = primaryImage(item.images);
  const src = cover ? imageUrl(cover) : null;
  const platform = item.item_platforms?.find((p) => p.platform)?.platform?.name;
  const date = formatDate(item.end_date ?? item.start_date ?? item.created_at);
  const statusColor = item.status?.color ?? "#9CA3AF";

  return (
    <Link
      href={`/polozka/${item.id}`}
      className="card-hover group flex flex-col overflow-hidden rounded-xl border border-line bg-card"
    >
      {/* Obálka */}
      <div
        className="relative aspect-[2/3]"
        style={
          src
            ? undefined
            : {
                background: `linear-gradient(160deg, color-mix(in srgb, ${color} 24%, #17171A) 0%, #121215 68%)`,
              }
        }
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <span
            className="absolute inset-0 flex items-center justify-center text-3xl font-bold tracking-tight"
            style={{ color: `color-mix(in srgb, ${color} 70%, #F4F4F5)` }}
            aria-hidden
          >
            {titleInitials(item.title)}
          </span>
        )}

        {item.status && (
          <span
            className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-md"
            style={{
              backgroundColor: `color-mix(in srgb, ${statusColor} 22%, rgba(11,11,13,0.75))`,
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
      </div>

      {/* Metadata */}
      <div className="flex flex-1 flex-col gap-0.5 p-3">
        <h3 className="truncate text-sm font-semibold tracking-tight text-ink">
          {item.title}
        </h3>
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <TypeIcon slug={item.media_type?.slug} size={12} />
          {item.media_type?.name}
        </p>
        {item.rating !== null && (
          <p className="mt-1 flex items-center gap-1.5">
            <StarDisplay value={item.rating} size={11} />
            <span className="text-[11px] font-medium tabular-nums text-muted">
              {(item.rating / 2).toLocaleString("cs-CZ")}
            </span>
          </p>
        )}
        <p className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-[11px] text-muted/80">
          <span className="truncate">{platform ?? ""}</span>
          {date && <span className="shrink-0">{date}</span>}
        </p>
      </div>
    </Link>
  );
}
