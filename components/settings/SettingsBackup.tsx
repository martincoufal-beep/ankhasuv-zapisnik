"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomField, Status, StatusMeaning } from "@/lib/types";
import type { SettingsData } from "./SettingsClient";
import { imageUrl } from "@/lib/helpers";

interface ExportImage {
  kind: string;
  is_primary: boolean;
  url: string | null;
  source: string;
  source_name: string | null;
}

interface ExportItem {
  title: string;
  media_type_slug: string | null;
  status: { label: string; meaning: StatusMeaning } | null;
  rating: number | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  platforms: string[];
  genres: string[];
  tags: string[];
  links: { kind: string; url: string }[];
  images: ExportImage[];
  fields: { name: string; value: unknown }[];
}

interface ExportFile {
  app: string;
  version: number;
  exported_at: string;
  custom: {
    media_types: { slug: string; name: string; color: string; sort: number }[];
    platforms: { name: string; group_name: string | null; sort: number; types: string[] }[];
    statuses: {
      media_type_slug: string | null;
      meaning: StatusMeaning;
      label: string;
      color: string | null;
      sort: number;
    }[];
    genres: { name: string }[];
  };
  items: ExportItem[];
}

export default function SettingsBackup({
  data,
  onChanged,
}: {
  data: SettingsData;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function exportJson() {
    setBusy("Skládám zálohu…");
    setResult(null);
    setErrors([]);

    const { data: items, error } = await supabase
      .from("items")
      .select(
        `title, rating, start_date, end_date, notes, created_at,
         media_type:media_types(slug),
         status:statuses(label, meaning),
         item_platforms(platform:platforms(name)),
         item_genres(genre:genres(name)),
         item_tags(tag:tags(name)),
         links(kind, url),
         images(kind, source, storage_path, external_url, source_name, is_primary),
         custom_field_values(value, field:custom_fields(name))`
      )
      .order("created_at");

    if (error) {
      setBusy(null);
      setResult("Export se nepovedl — data se nepodařilo načíst.");
      return;
    }

    const typeSlug = new Map(data.mediaTypes.map((t) => [t.id, t.slug]));
    const platformName = new Map(data.platforms.map((p) => [p.id, p.name]));

    const payload: ExportFile = {
      app: "ankhasuv-zapisnik",
      version: 1,
      exported_at: new Date().toISOString(),
      custom: {
        media_types: data.mediaTypes
          .filter((t) => t.user_id !== null)
          .map((t) => ({ slug: t.slug, name: t.name, color: t.color, sort: t.sort })),
        platforms: data.platforms
          .filter((p) => p.user_id !== null)
          .map((p) => ({
            name: p.name,
            group_name: p.group_name,
            sort: p.sort,
            types: data.mtp
              .filter((r) => r.platform_id === p.id)
              .map((r) => typeSlug.get(r.media_type_id))
              .filter(Boolean) as string[],
          })),
        statuses: data.statuses
          .filter((s) => s.user_id !== null)
          .map((s) => ({
            media_type_slug: s.media_type_id ? (typeSlug.get(s.media_type_id) ?? null) : null,
            meaning: s.meaning,
            label: s.label,
            color: s.color,
            sort: s.sort,
          })),
        genres: data.genres
          .filter((g) => g.user_id != null)
          .map((g) => ({ name: g.name })),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: (items as any[]).map((i): ExportItem => ({
        title: i.title,
        media_type_slug: i.media_type?.slug ?? null,
        status: i.status ? { label: i.status.label, meaning: i.status.meaning } : null,
        rating: i.rating,
        start_date: i.start_date,
        end_date: i.end_date,
        notes: i.notes,
        created_at: i.created_at,
        platforms: i.item_platforms.map((p: { platform: { name: string } | null }) => p.platform?.name).filter(Boolean),
        genres: i.item_genres.map((g: { genre: { name: string } | null }) => g.genre?.name).filter(Boolean),
        tags: i.item_tags.map((t: { tag: { name: string } | null }) => t.tag?.name).filter(Boolean),
        links: i.links,
        images: i.images.map((img: Parameters<typeof imageUrl>[0] & ExportImage) => ({
          kind: img.kind,
          is_primary: img.is_primary,
          url: imageUrl(img),
          source: img.source,
          source_name: img.source_name,
        })),
        fields: i.custom_field_values
          .filter((v: { field: { name: string } | null }) => v.field)
          .map((v: { value: unknown; field: { name: string } }) => ({
            name: v.field.name,
            value: v.value,
          })),
      })),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ankhasuv-zapisnik-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBusy(null);
    setResult(`Vyexportováno ${payload.items.length} položek.`);
  }

  async function importJson(file: File) {
    setBusy("Čtu zálohu…");
    setResult(null);
    setErrors([]);
    const problems: string[] = [];

    let parsed: ExportFile;
    try {
      parsed = JSON.parse(await file.text());
      if (parsed.app !== "ankhasuv-zapisnik" || !Array.isArray(parsed.items)) {
        throw new Error("format");
      }
    } catch {
      setBusy(null);
      setResult("Tohle nevypadá jako záloha Ankhasova zápisníku.");
      return;
    }

    // 1) Doplnit vlastní číselníky ze zálohy
    setBusy("Zakládám číselníky…");
    const custom = parsed.custom ?? { media_types: [], platforms: [], statuses: [], genres: [] };
    for (const t of custom.media_types ?? []) {
      if (!data.mediaTypes.some((x) => x.slug === t.slug)) {
        const { error } = await supabase.from("media_types").insert({
          user_id: data.userId,
          slug: t.slug,
          name: t.name,
          color: t.color,
          field_groups: [],
          sort: t.sort,
        });
        if (error) problems.push(`Typ ${t.name}: nepodařilo se založit.`);
      }
    }

    // Čerstvé číselníky po založení typů
    const [mt, pl, st, ge, cf] = await Promise.all([
      supabase.from("media_types").select("*"),
      supabase.from("platforms").select("*"),
      supabase.from("statuses").select("*"),
      supabase.from("genres").select("*"),
      supabase.from("custom_fields").select("*"),
    ]);
    const types = mt.data ?? [];
    const platforms = pl.data ?? [];
    const statuses = (st.data ?? []) as Status[];
    const genres = ge.data ?? [];
    const fields = (cf.data ?? []) as CustomField[];
    const typeBySlug = new Map(types.map((t) => [t.slug, t]));

    for (const p of custom.platforms ?? []) {
      if (!platforms.some((x) => x.name === p.name)) {
        const { data: row, error } = await supabase
          .from("platforms")
          .insert({
            user_id: data.userId,
            name: p.name,
            group_name: p.group_name,
            sort: p.sort,
          })
          .select("*")
          .single();
        if (error || !row) {
          problems.push(`Platforma ${p.name}: nepodařilo se založit.`);
          continue;
        }
        platforms.push(row);
        const assignments = (p.types ?? [])
          .map((slug) => typeBySlug.get(slug)?.id)
          .filter(Boolean)
          .map((tid) => ({
            media_type_id: tid,
            platform_id: row.id,
            user_id: data.userId,
          }));
        if (assignments.length > 0) {
          await supabase.from("media_type_platforms").insert(assignments);
        }
      }
    }

    for (const s of custom.statuses ?? []) {
      const tid = s.media_type_slug ? (typeBySlug.get(s.media_type_slug)?.id ?? null) : null;
      if (s.media_type_slug && !tid) continue;
      if (!statuses.some((x) => (x.media_type_id ?? null) === tid && x.label === s.label)) {
        const { data: row, error } = await supabase
          .from("statuses")
          .insert({
            user_id: data.userId,
            media_type_id: tid,
            meaning: s.meaning,
            label: s.label,
            color: s.color,
            sort: s.sort,
          })
          .select("*")
          .single();
        if (!error && row) statuses.push(row as Status);
      }
    }

    for (const g of custom.genres ?? []) {
      if (!genres.some((x) => x.name === g.name)) {
        const { data: row } = await supabase
          .from("genres")
          .insert({ user_id: data.userId, name: g.name })
          .select("*")
          .single();
        if (row) genres.push(row);
      }
    }

    // 2) Položky
    let imported = 0;
    for (const [idx, item] of parsed.items.entries()) {
      setBusy(`Zapisuji položky… ${idx + 1} / ${parsed.items.length}`);
      try {
        const type =
          (item.media_type_slug ? typeBySlug.get(item.media_type_slug) : null) ??
          typeBySlug.get("ostatni") ??
          types[0];
        if (!type) throw new Error("Chybí typ média.");

        let statusId: string | null = null;
        if (item.status) {
          const byLabel = statuses.find(
            (s) => s.media_type_id === type.id && s.label === item.status!.label
          );
          const byMeaning = statuses.find(
            (s) => s.media_type_id === type.id && s.meaning === item.status!.meaning
          );
          const globalByMeaning = statuses.find(
            (s) => s.media_type_id === null && s.meaning === item.status!.meaning
          );
          statusId = (byLabel ?? byMeaning ?? globalByMeaning)?.id ?? null;
        }

        const { data: row, error } = await supabase
          .from("items")
          .insert({
            user_id: data.userId,
            title: item.title,
            media_type_id: type.id,
            status_id: statusId,
            rating: item.rating,
            start_date: item.start_date,
            end_date: item.end_date,
            notes: item.notes,
          })
          .select("id")
          .single();
        if (error || !row) throw error ?? new Error("insert");
        const itemId = row.id as string;

        const platformRows = (item.platforms ?? [])
          .map((name) => platforms.find((p) => p.name === name)?.id)
          .filter(Boolean)
          .map((pid) => ({ item_id: itemId, platform_id: pid }));
        if (platformRows.length > 0)
          await supabase.from("item_platforms").insert(platformRows);

        const genreRows: { item_id: string; genre_id: string }[] = [];
        for (const name of item.genres ?? []) {
          let genre = genres.find((g) => g.name === name);
          if (!genre) {
            const { data: created } = await supabase
              .from("genres")
              .insert({ user_id: data.userId, name })
              .select("*")
              .single();
            if (created) {
              genres.push(created);
              genre = created;
            }
          }
          if (genre) genreRows.push({ item_id: itemId, genre_id: genre.id });
        }
        if (genreRows.length > 0)
          await supabase.from("item_genres").insert(genreRows);

        const tagNames = [...new Set(item.tags ?? [])];
        if (tagNames.length > 0) {
          const { data: tagRows } = await supabase
            .from("tags")
            .upsert(
              tagNames.map((name) => ({ user_id: data.userId, name })),
              { onConflict: "user_id,name", ignoreDuplicates: false }
            )
            .select("id");
          if (tagRows && tagRows.length > 0) {
            await supabase.from("item_tags").insert(
              tagRows.map((t) => ({ item_id: itemId, tag_id: t.id }))
            );
          }
        }

        if ((item.links ?? []).length > 0) {
          await supabase.from("links").insert(
            item.links.map((l) => ({ item_id: itemId, kind: l.kind, url: l.url }))
          );
        }

        const imageRows = (item.images ?? [])
          .filter((img) => img.url)
          .map((img) => ({
            item_id: itemId,
            user_id: data.userId,
            kind: img.kind,
            // Nahrané soubory nejsou v záloze — vracejí se jako odkaz na původní URL
            source: img.source === "upload" ? "url" : img.source,
            external_url: img.url,
            source_name: img.source_name,
            is_primary: img.is_primary,
          }));
        if (imageRows.length > 0)
          await supabase.from("images").insert(imageRows);

        const fieldRows = (item.fields ?? []).flatMap((f) => {
          const field = fields.find(
            (x) => x.media_type_id === type.id && x.name === f.name
          );
          return field
            ? [{ item_id: itemId, field_id: field.id, value: f.value }]
            : [];
        });
        if (fieldRows.length > 0)
          await supabase.from("custom_field_values").insert(fieldRows);

        imported++;
      } catch (e) {
        console.error(e);
        problems.push(`Položka „${item.title}“ se nenačetla celá.`);
      }
    }

    setBusy(null);
    setErrors(problems);
    setResult(
      `Načteno ${imported} z ${parsed.items.length} položek.` +
        (problems.length > 0 ? " Některé kroky se nepovedly — viz níže." : "")
    );
    if (fileRef.current) fileRef.current.value = "";
    onChanged();
  }

  return (
    <div className="max-w-xl">
      <section className="rounded-lg border border-line bg-card p-4">
        <h3 className="text-base font-bold tracking-tight">Export</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Stáhne celý zápisník jako JSON — položky, stavy, tagy, odkazy,
          obrázky (jako URL) i vlastní číselníky. Hodí se jako záloha
          i pro přenos jinam.
        </p>
        <button
          onClick={exportJson}
          disabled={busy !== null}
          className="transition-quick mt-3 rounded-md bg-brass px-4 py-1.5 text-sm font-medium text-bg hover:bg-brass-deep disabled:opacity-50"
        >
          Stáhnout zálohu
        </button>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-card p-4">
        <h3 className="text-base font-bold tracking-tight">Import</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Načte zálohu Ankhasova zápisníku. Položky se přidají k těm
          stávajícím (nic se nemaže); číselníky se dohledají podle názvů,
          chybějící vlastní se založí.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importJson(f);
          }}
          disabled={busy !== null}
          aria-label="Soubor zálohy"
          className="mt-3 block text-sm text-muted file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-line file:bg-bg file:px-3 file:py-1.5 file:text-sm file:text-ink hover:file:border-muted/60"
        />
      </section>

      {busy && <p className="mt-3 text-sm text-muted">{busy}</p>}
      {result && <p className="mt-3 text-sm text-ink">{result}</p>}
      {errors.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-[#D46A5B]">
          {errors.slice(0, 10).map((e, i) => (
            <li key={i}>{e}</li>
          ))}
          {errors.length > 10 && (
            <li>… a dalších {errors.length - 10} problémů.</li>
          )}
        </ul>
      )}
    </div>
  );
}
