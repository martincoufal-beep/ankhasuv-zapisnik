import { createClient } from "@/lib/supabase/server";
import type { ItemWithRelations, MediaType } from "@/lib/types";
import { STAV_VIEWS } from "@/lib/types";
import Library from "@/components/Library";

export const metadata = { title: "Knihovna" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stav?: string; typ?: string }>;
}) {
  const { q, stav, typ } = await searchParams;
  const supabase = await createClient();

  const [{ data: itemsData }, { data: typesData }] = await Promise.all([
    supabase
      .from("items")
      .select(
        "*, media_type:media_types(*), status:statuses(*), images(*), item_platforms(platform:platforms(name))"
      )
      .order("created_at", { ascending: false }),
    supabase.from("media_types").select("*").order("sort"),
  ]);

  const mediaTypes = (typesData ?? []) as MediaType[];
  let items = (itemsData ?? []) as ItemWithRelations[];

  // Pohled ze sidebardu (Rozpracováno / Dokončeno / Backlog) zúží data předem
  const view = stav ? STAV_VIEWS[stav] : undefined;
  if (view) {
    const meanings = new Set(view.meanings);
    items = items.filter((i) => i.status && meanings.has(i.status.meaning));
  }

  const initialTypeId = typ
    ? (mediaTypes.find((t) => t.slug === typ)?.id ?? null)
    : null;

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">
        {view?.title ?? "Knihovna"}
      </h1>
      <div className="mt-4">
        <Library
          key={`${q ?? ""}|${stav ?? ""}|${typ ?? ""}`}
          items={items}
          mediaTypes={mediaTypes}
          initialSearch={q ?? ""}
          initialTypeId={initialTypeId}
          isView={Boolean(view)}
        />
      </div>
    </main>
  );
}
