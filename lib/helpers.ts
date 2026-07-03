import type { ImageRow, Status } from "./types";

/** URL obrázku — externí odkaz, nebo veřejná cesta v bucketu covers. */
export function imageUrl(img: {
  storage_path: string | null;
  external_url: string | null;
}): string | null {
  if (img.external_url) return img.external_url;
  if (img.storage_path) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/covers/${img.storage_path}`;
  }
  return null;
}

/** Hlavní obálka položky (nebo první obrázek, pokud hlavní chybí). */
export function primaryImage(
  images: ImageRow[] | null | undefined
): ImageRow | null {
  if (!images || images.length === 0) return null;
  return images.find((i) => i.is_primary) ?? images[0];
}

/** Datum v českém formátu, např. „12. 3. 2026". */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/**
 * Stavy nabízené pro daný typ média (kap. 7 návrhu): typové stavy
 * + globální stavy těch významů, které typ nepokrývá.
 */
export function statusesForType(
  all: Status[],
  mediaTypeId: string | null
): Status[] {
  const typed = mediaTypeId
    ? all.filter((s) => s.media_type_id === mediaTypeId)
    : [];
  const covered = new Set(typed.map((s) => s.meaning));
  const globals = all.filter(
    (s) => s.media_type_id === null && !covered.has(s.meaning)
  );
  return [...typed, ...globals].sort((a, b) => a.sort - b.sort);
}

/** Iniciály titulu pro placeholder obálky (max 2 znaky). */
export function titleInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
}
