"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  CustomField,
  Genre,
  ItemLink,
  LinkKind,
  MediaType,
  Platform,
  Status,
} from "@/lib/types";
import { LINK_KIND_LABELS } from "@/lib/types";
import { statusesForType } from "@/lib/helpers";
import { StarInput } from "./StarRating";
import CoverSearch, { type CoverCandidate } from "./CoverSearch";
import { TypeIcon } from "./icons";

type FieldValue = string | number | boolean | string[];

interface Lookups {
  mediaTypes: MediaType[];
  statuses: Status[];
  platforms: Platform[];
  typePlatforms: Map<string, Set<string>>; // media_type_id -> platform ids
  customFields: CustomField[];
  genres: Genre[];
}

const inputCls =
  "transition-quick w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink placeholder:text-muted/60 hover:border-[#34343b] focus:border-brass/60";
const chipCls =
  "transition-quick cursor-pointer rounded-full border px-3 py-1 text-xs font-medium";
const chipOff =
  "border-line text-muted hover:border-[#34343b] hover:text-ink";

export default function ItemForm({ itemId }: { itemId?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [lookups, setLookups] = useState<Lookups | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Stav formuláře
  const [title, setTitle] = useState("");
  const [mediaTypeId, setMediaTypeId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>("");
  const [rating, setRating] = useState<number | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [platformIds, setPlatformIds] = useState<Set<string>>(new Set());
  const [genreIds, setGenreIds] = useState<Set<string>>(new Set());
  const [tagsText, setTagsText] = useState("");
  const [links, setLinks] = useState<ItemLink[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, FieldValue>>(
    {}
  );
  // Obálka vybraná z online hledání — uloží se až se zápisem položky
  const [pendingCover, setPendingCover] = useState<CoverCandidate | null>(null);
  const [existingImages, setExistingImages] = useState(0);

  // Načtení číselníků (+ položky v režimu úprav)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [mt, st, pl, mtp, cf, ge] = await Promise.all([
        supabase.from("media_types").select("*").order("sort"),
        supabase.from("statuses").select("*").order("sort"),
        supabase.from("platforms").select("*").order("sort"),
        supabase.from("media_type_platforms").select("media_type_id, platform_id"),
        supabase.from("custom_fields").select("*").order("sort"),
        supabase.from("genres").select("*").order("name"),
      ]);
      if (cancelled) return;
      if (mt.error || st.error || pl.error || mtp.error || cf.error || ge.error) {
        setLoadError(true);
        return;
      }
      const typePlatforms = new Map<string, Set<string>>();
      for (const row of mtp.data) {
        const set = typePlatforms.get(row.media_type_id) ?? new Set<string>();
        set.add(row.platform_id);
        typePlatforms.set(row.media_type_id, set);
      }
      setLookups({
        mediaTypes: mt.data as MediaType[],
        statuses: st.data as Status[],
        platforms: pl.data as Platform[],
        typePlatforms,
        customFields: cf.data as CustomField[],
        genres: ge.data as Genre[],
      });

      if (itemId) {
        const { data: item, error } = await supabase
          .from("items")
          .select(
            `*,
             images(id),
             item_platforms(platform_id),
             item_genres(genre_id),
             item_tags(tag:tags(name)),
             links(kind, url),
             custom_field_values(field_id, value)`
          )
          .eq("id", itemId)
          .maybeSingle();
        if (cancelled) return;
        if (error || !item) {
          setLoadError(true);
          return;
        }
        setTitle(item.title);
        setMediaTypeId(item.media_type_id);
        setExistingImages((item.images as { id: string }[]).length);
        setStatusId(item.status_id ?? "");
        setRating(item.rating);
        setStartDate(item.start_date ?? "");
        setEndDate(item.end_date ?? "");
        setNotes(item.notes ?? "");
        setPlatformIds(
          new Set(
            (item.item_platforms as { platform_id: string }[]).map(
              (p) => p.platform_id
            )
          )
        );
        setGenreIds(
          new Set(
            (item.item_genres as { genre_id: string }[]).map((g) => g.genre_id)
          )
        );
        setTagsText(
          (item.item_tags as { tag: { name: string } | null }[])
            .map((t) => t.tag?.name)
            .filter(Boolean)
            .join(", ")
        );
        setLinks(item.links as ItemLink[]);
        const values: Record<string, FieldValue> = {};
        for (const v of item.custom_field_values as {
          field_id: string;
          value: FieldValue;
        }[]) {
          values[v.field_id] = v.value;
        }
        setFieldValues(values);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, itemId]);

  // Podmíněné nabídky podle zvoleného typu média
  const selectedType = lookups?.mediaTypes.find((t) => t.id === mediaTypeId);
  const typeColor = selectedType?.color ?? "#8B8FA3";

  const availableStatuses = useMemo(
    () => (lookups ? statusesForType(lookups.statuses, mediaTypeId || null) : []),
    [lookups, mediaTypeId]
  );

  const availablePlatforms = useMemo(() => {
    if (!lookups || !mediaTypeId) return [];
    const ids = lookups.typePlatforms.get(mediaTypeId);
    if (!ids) return [];
    return lookups.platforms.filter((p) => ids.has(p.id));
  }, [lookups, mediaTypeId]);

  const platformGroups = useMemo(() => {
    const groups = new Map<string, Platform[]>();
    for (const p of availablePlatforms) {
      const key = p.group_name ?? "Ostatní";
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    return [...groups.entries()];
  }, [availablePlatforms]);

  const typeFields = useMemo(
    () =>
      lookups && mediaTypeId
        ? lookups.customFields.filter((f) => f.media_type_id === mediaTypeId)
        : [],
    [lookups, mediaTypeId]
  );

  // Platformy zvolené dřív, které k novému typu nepatří — nezahazovat, jen upozornit
  const orphanPlatforms = useMemo(() => {
    if (!lookups || !mediaTypeId) return [];
    const ids = lookups.typePlatforms.get(mediaTypeId) ?? new Set();
    return lookups.platforms.filter(
      (p) => platformIds.has(p.id) && !ids.has(p.id)
    );
  }, [lookups, mediaTypeId, platformIds]);

  function changeType(newTypeId: string) {
    setMediaTypeId(newTypeId);
    if (!lookups) return;
    // Stav zkusit převést podle významu (dohráno → přečteno), jinak zrušit
    const current = lookups.statuses.find((s) => s.id === statusId);
    const next = statusesForType(lookups.statuses, newTypeId);
    if (current) {
      const match = next.find((s) => s.meaning === current.meaning);
      setStatusId(match?.id ?? "");
    }
  }

  function toggle(set: Set<string>, id: string): Set<string> {
    const copy = new Set(set);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    return copy;
  }

  function setFieldValue(fieldId: string, value: FieldValue | undefined) {
    setFieldValues((prev) => {
      const copy = { ...prev };
      if (value === undefined) delete copy[fieldId];
      else copy[fieldId] = value;
      return copy;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lookups || !title.trim() || !mediaTypeId) return;
    setSaving(true);
    setSaveError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejsi přihlášený.");

      const itemData = {
        user_id: user.id,
        title: title.trim(),
        media_type_id: mediaTypeId,
        status_id: statusId || null,
        rating,
        start_date: startDate || null,
        end_date: endDate || null,
        notes: notes.trim() || null,
      };

      let id = itemId;
      if (id) {
        const { error } = await supabase
          .from("items")
          .update(itemData)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("items")
          .insert(itemData)
          .select("id")
          .single();
        if (error) throw error;
        id = data.id as string;
      }

      // Tagy: založit chybějící, získat id
      const tagNames = [
        ...new Set(
          tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        ),
      ];
      let tagIds: string[] = [];
      if (tagNames.length > 0) {
        const { data: tagRows, error } = await supabase
          .from("tags")
          .upsert(
            tagNames.map((name) => ({ user_id: user.id, name })),
            { onConflict: "user_id,name", ignoreDuplicates: false }
          )
          .select("id");
        if (error) throw error;
        tagIds = tagRows.map((t) => t.id as string);
      }

      // Vazby: smazat a zapsat znovu (jednoduché a spolehlivé pro osobní data)
      const validLinks = links.filter((l) => l.url.trim());
      const cfRows = Object.entries(fieldValues)
        .filter(([fieldId, value]) => {
          if (!typeFields.some((f) => f.id === fieldId)) return false;
          if (typeof value === "string") return value.trim() !== "";
          if (Array.isArray(value)) return value.length > 0;
          if (typeof value === "boolean") return value;
          return !Number.isNaN(value);
        })
        .map(([field_id, value]) => ({ item_id: id!, field_id, value }));

      const syncs: [string, Record<string, unknown>[]][] = [
        [
          "item_platforms",
          [...platformIds].map((pid) => ({ item_id: id!, platform_id: pid })),
        ],
        [
          "item_genres",
          [...genreIds].map((gid) => ({ item_id: id!, genre_id: gid })),
        ],
        ["item_tags", tagIds.map((tid) => ({ item_id: id!, tag_id: tid }))],
        [
          "links",
          validLinks.map((l) => ({ item_id: id!, kind: l.kind, url: l.url.trim() })),
        ],
        ["custom_field_values", cfRows],
      ];

      for (const [table, rows] of syncs) {
        const del = await supabase.from(table).delete().eq("item_id", id);
        if (del.error) throw del.error;
        if (rows.length > 0) {
          const ins = await supabase.from(table).insert(rows);
          if (ins.error) throw ins.error;
        }
      }

      // Obálka vybraná z online hledání
      if (pendingCover) {
        const { error: imgErr } = await supabase.from("images").insert({
          item_id: id,
          user_id: user.id,
          kind: "cover",
          source: "api",
          external_url: pendingCover.fullUrl ?? pendingCover.thumbUrl,
          source_name: pendingCover.source,
          is_primary: existingImages === 0,
        });
        if (imgErr) console.error(imgErr);
      }

      router.push(`/polozka/${id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setSaveError(
        "Zápis se nepovedl uložit. Zkontroluj připojení a zkus to znovu."
      );
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <p className="text-xl font-bold tracking-tight">
          Zápisník se nepodařilo otevřít.
        </p>
        <p className="mt-2 leading-relaxed text-muted">
          Číselníky se nenačetly — zkontroluj připojení a zkus stránku obnovit.
        </p>
        <button
          onClick={() => location.reload()}
          className="transition-quick mt-5 rounded-md border border-line px-4 py-2 text-sm text-muted hover:border-muted/60 hover:text-ink"
        >
          Obnovit stránku
        </button>
      </div>
    );
  }

  if (!lookups) {
    return (
      <p className="py-20 text-center text-sm text-muted">Otevírám zápisník…</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      {/* Základ */}
      <section>
        <label htmlFor="title" className="mb-1.5 block text-sm text-muted">
          Název <span className="text-brass">*</span>
        </label>
        <input
          id="title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Disco Elysium, Spálené kosti, Zaklínač…"
          className={`${inputCls} text-base`}
        />

        <p className="mb-1.5 mt-4 text-sm text-muted">
          Typ média <span className="text-brass">*</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {lookups.mediaTypes.map((t) => {
            const active = mediaTypeId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => changeType(t.id)}
                aria-pressed={active}
                className={
                  active
                    ? "btn-accent flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                    : `${chipCls} flex items-center gap-1.5 py-1.5 ${chipOff}`
                }
              >
                <TypeIcon slug={t.slug} size={13} />
                {t.name}
              </button>
            );
          })}
        </div>

        {/* Online hledání obálky (kap. 3.3) */}
        {title.trim() && selectedType && (
          <div className="mt-4">
            {pendingCover ? (
              <div className="flex items-center gap-3 rounded-xl border border-line bg-card p-2.5">
                {(pendingCover.thumbUrl ?? pendingCover.fullUrl) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pendingCover.thumbUrl ?? pendingCover.fullUrl ?? ""}
                    alt=""
                    className="h-16 w-11 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-semibold">{pendingCover.title}</p>
                  <p className="text-xs text-muted">
                    Obálka se uloží se zápisem · {pendingCover.year ?? "?"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingCover(null)}
                  className="transition-quick shrink-0 text-xs font-medium text-muted hover:text-red"
                >
                  Zrušit
                </button>
              </div>
            ) : (
              <CoverSearch
                title={title}
                typeSlug={selectedType.slug}
                onPick={setPendingCover}
              />
            )}
          </div>
        )}
      </section>

      {mediaTypeId && (
        <>
          {/* Stav + hodnocení — nabídka stavů podle typu */}
          <section className="rounded-xl border border-line bg-card p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="status" className="mb-1.5 block text-sm text-muted">
                  Stav
                </label>
                <select
                  id="status"
                  value={statusId}
                  onChange={(e) => setStatusId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">— bez stavu —</option>
                  {availableStatuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <p className="mb-1.5 text-sm text-muted">Hodnocení</p>
                <StarInput value={rating} onChange={setRating} />
              </div>
              <div>
                <label htmlFor="start" className="mb-1.5 block text-sm text-muted">
                  Začátek
                </label>
                <input
                  id="start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="end" className="mb-1.5 block text-sm text-muted">
                  Konec / dokončení
                </label>
                <input
                  id="end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </section>

          {/* Platformy podle typu */}
          {(platformGroups.length > 0 || orphanPlatforms.length > 0) && (
            <section>
              <p className="mb-1.5 text-sm text-muted">
                Platforma / formát{" "}
                <span className="text-muted/60">(lze vybrat víc)</span>
              </p>
              {orphanPlatforms.length > 0 && (
                <p className="mb-2 rounded-md border border-brass/40 bg-brass/10 px-3 py-2 text-xs leading-relaxed text-brass">
                  {orphanPlatforms.map((p) => p.name).join(", ")} nepatří k
                  typu {selectedType?.name} — výběr zůstane uložený, dokud ho
                  sám nezrušíš.
                </p>
              )}
              <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-line bg-card p-3">
                {orphanPlatforms.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted/70">
                      Mimo typ
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {orphanPlatforms.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPlatformIds(toggle(platformIds, p.id))}
                          aria-pressed
                          className={`${chipCls} border-brass/50 text-brass`}
                        >
                          {p.name} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {platformGroups.map(([group, list]) => (
                  <div key={group}>
                    {platformGroups.length > 1 && (
                      <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted/70">
                        {group}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((p) => {
                        const active = platformIds.has(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              setPlatformIds(toggle(platformIds, p.id))
                            }
                            aria-pressed={active}
                            className={`${chipCls} ${
                              active
                                ? "border-transparent bg-ink/10 text-ink"
                                : chipOff
                            }`}
                            style={
                              active
                                ? { borderColor: typeColor, color: "#ECE9E1" }
                                : undefined
                            }
                          >
                            {p.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Typová pole (výchozí custom_fields daného typu) */}
          {typeFields.length > 0 && (
            <section className="rounded-xl border border-line bg-card p-4">
              <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                <span style={{ color: typeColor }}>
                  <TypeIcon slug={selectedType?.slug} size={16} />
                </span>
                Podrobnosti — {selectedType?.name}
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {typeFields.map((field) => {
                  const value = fieldValues[field.id];
                  switch (field.field_type) {
                    case "boolean":
                      return (
                        <label
                          key={field.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={value === true}
                            onChange={(e) =>
                              setFieldValue(
                                field.id,
                                e.target.checked ? true : undefined
                              )
                            }
                            className="h-4 w-4 accent-[#D4A75A]"
                          />
                          {field.name}
                        </label>
                      );
                    case "select":
                      return (
                        <div key={field.id}>
                          <label
                            htmlFor={`cf-${field.id}`}
                            className="mb-1.5 block text-sm text-muted"
                          >
                            {field.name}
                          </label>
                          <select
                            id={`cf-${field.id}`}
                            value={typeof value === "string" ? value : ""}
                            onChange={(e) =>
                              setFieldValue(
                                field.id,
                                e.target.value || undefined
                              )
                            }
                            className={inputCls}
                          >
                            <option value="">—</option>
                            {(field.options ?? []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    case "multiselect":
                      return (
                        <div key={field.id} className="sm:col-span-2">
                          <p className="mb-1.5 text-sm text-muted">
                            {field.name}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {(field.options ?? []).map((opt) => {
                              const list = Array.isArray(value) ? value : [];
                              const active = list.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  aria-pressed={active}
                                  onClick={() => {
                                    const next = active
                                      ? list.filter((o) => o !== opt)
                                      : [...list, opt];
                                    setFieldValue(
                                      field.id,
                                      next.length ? next : undefined
                                    );
                                  }}
                                  className={`${chipCls} ${
                                    active
                                      ? "border-brass/70 text-brass"
                                      : chipOff
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    default:
                      return (
                        <div key={field.id}>
                          <label
                            htmlFor={`cf-${field.id}`}
                            className="mb-1.5 block text-sm text-muted"
                          >
                            {field.name}
                          </label>
                          <input
                            id={`cf-${field.id}`}
                            type={
                              field.field_type === "number"
                                ? "number"
                                : field.field_type === "date"
                                  ? "date"
                                  : "text"
                            }
                            value={
                              typeof value === "number" ||
                              typeof value === "string"
                                ? value
                                : ""
                            }
                            onChange={(e) => {
                              if (field.field_type === "number") {
                                setFieldValue(
                                  field.id,
                                  e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value)
                                );
                              } else {
                                setFieldValue(
                                  field.id,
                                  e.target.value || undefined
                                );
                              }
                            }}
                            className={inputCls}
                          />
                        </div>
                      );
                  }
                })}
              </div>
            </section>
          )}

          {/* Žánry a tagy */}
          <section>
            <p className="mb-1.5 text-sm text-muted">Žánry</p>
            <div className="flex flex-wrap gap-1.5">
              {lookups.genres.map((g) => {
                const active = genreIds.has(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGenreIds(toggle(genreIds, g.id))}
                    className={`${chipCls} ${
                      active ? "border-brass/70 text-brass" : chipOff
                    }`}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
            <label htmlFor="tags" className="mb-1.5 mt-4 block text-sm text-muted">
              Tagy <span className="text-muted/60">(oddělené čárkou)</span>
            </label>
            <input
              id="tags"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="cozy, spolu s Bárou, klasika…"
              className={inputCls}
            />
          </section>

          {/* Odkazy */}
          <section>
            <p className="mb-1.5 text-sm text-muted">Externí odkazy</p>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={link.kind}
                    aria-label="Typ odkazu"
                    onChange={(e) =>
                      setLinks(
                        links.map((l, j) =>
                          j === i ? { ...l, kind: e.target.value as LinkKind } : l
                        )
                      )
                    }
                    className={`${inputCls} w-40 shrink-0`}
                  >
                    {Object.entries(LINK_KIND_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={link.url}
                    aria-label="URL odkazu"
                    onChange={(e) =>
                      setLinks(
                        links.map((l, j) =>
                          j === i ? { ...l, url: e.target.value } : l
                        )
                      )
                    }
                    placeholder="https://…"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    aria-label="Odebrat odkaz"
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    className="transition-quick shrink-0 rounded-md border border-line px-3 text-muted hover:border-[#D46A5B]/60 hover:text-[#D46A5B]"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setLinks([...links, { kind: "other", url: "" }])}
                className="transition-quick rounded-md border border-line px-3 py-1.5 text-xs text-muted hover:border-muted/60 hover:text-ink"
              >
                + Přidat odkaz
              </button>
            </div>
          </section>

          {/* Poznámky */}
          <section>
            <label htmlFor="notes" className="mb-1.5 block text-sm text-muted">
              Poznámky / recenze
            </label>
            <textarea
              id="notes"
              rows={5}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Co sis z toho odnesl? Citace, dojmy, kdy a s kým…"
              className={inputCls}
            />
          </section>
        </>
      )}

      {/* Uložení */}
      <div className="flex items-center gap-3 border-t border-line pt-5">
        <button
          type="submit"
          disabled={saving || !title.trim() || !mediaTypeId}
          className="btn-accent rounded-lg px-5 py-2 disabled:opacity-50"
        >
          {saving ? "Zapisuji…" : itemId ? "Uložit změny" : "Zapsat do zápisníku"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="transition-quick rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
        >
          Zrušit
        </button>
        {saveError && (
          <p className="text-sm text-[#D46A5B]">{saveError}</p>
        )}
      </div>
    </form>
  );
}
