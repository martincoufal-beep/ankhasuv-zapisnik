"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SettingsData } from "./SettingsClient";
import { settingsInput } from "./SettingsTypes";

export default function SettingsPlatforms({
  data,
  onChanged,
}: {
  data: SettingsData;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [group, setGroup] = useState("");
  const [newTypeIds, setNewTypeIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const typeName = useMemo(
    () => new Map(data.mediaTypes.map((t) => [t.id, t.name])),
    [data.mediaTypes]
  );
  const assignedTypes = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const row of data.mtp) {
      const set = map.get(row.platform_id) ?? new Set<string>();
      set.add(row.media_type_id);
      map.set(row.platform_id, set);
    }
    return map;
  }, [data.mtp]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof data.platforms>();
    for (const p of data.platforms) {
      const key = p.group_name ?? "Ostatní";
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [data.platforms]);

  const existingGroups = useMemo(
    () => [...new Set(data.platforms.map((p) => p.group_name).filter(Boolean))] as string[],
    [data.platforms]
  );

  function toggleNewType(id: string) {
    const copy = new Set(newTypeIds);
    if (copy.has(id)) copy.delete(id);
    else copy.add(id);
    setNewTypeIds(copy);
  }

  async function addPlatform() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const { data: row, error } = await supabase
      .from("platforms")
      .insert({
        user_id: data.userId,
        name: name.trim(),
        group_name: group.trim() || null,
        sort: Math.max(...data.platforms.map((p) => p.sort), 0) + 10,
      })
      .select("id")
      .single();
    if (error || !row) {
      setBusy(false);
      setError("Platformu se nepodařilo přidat.");
      return;
    }
    if (newTypeIds.size > 0) {
      const { error: mtpErr } = await supabase.from("media_type_platforms").insert(
        [...newTypeIds].map((tid) => ({
          media_type_id: tid,
          platform_id: row.id,
          user_id: data.userId,
        }))
      );
      if (mtpErr) setError("Platforma vznikla, ale přiřazení k typům se nepovedlo.");
    }
    setBusy(false);
    setName("");
    setGroup("");
    setNewTypeIds(new Set());
    onChanged();
  }

  /** Přepnutí přiřazení vlastní platformy k typu (vlastní vazby lze mazat, výchozí ne). */
  async function toggleAssignment(platformId: string, mediaTypeId: string) {
    setBusy(true);
    setError(null);
    const existing = data.mtp.find(
      (r) => r.platform_id === platformId && r.media_type_id === mediaTypeId
    );
    if (existing) {
      if (existing.user_id === null) {
        setBusy(false);
        setError("Výchozí přiřazení nejde zrušit — je součástí základní sady.");
        return;
      }
      const { error } = await supabase
        .from("media_type_platforms")
        .delete()
        .eq("platform_id", platformId)
        .eq("media_type_id", mediaTypeId);
      if (error) setError("Změna přiřazení se nepovedla.");
    } else {
      const { error } = await supabase.from("media_type_platforms").insert({
        media_type_id: mediaTypeId,
        platform_id: platformId,
        user_id: data.userId,
      });
      if (error) setError("Změna přiřazení se nepovedla.");
    }
    setBusy(false);
    onChanged();
  }

  async function deletePlatform(id: string) {
    setBusy(true);
    setError(null);
    await supabase
      .from("media_type_platforms")
      .delete()
      .eq("platform_id", id);
    const { error } = await supabase.from("platforms").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setError(
        "Platforma nejde smazat — nejspíš je vybraná u některé položky."
      );
      return;
    }
    onChanged();
  }

  return (
    <div>
      <div className="space-y-4">
        {groups.map(([groupName, list]) => (
          <div key={groupName}>
            <h3 className="mb-1.5 text-[11px] uppercase tracking-wide text-muted/70">
              {groupName}
            </h3>
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">
              {list.map((p) => {
                const own = p.user_id !== null;
                const assigned = assignedTypes.get(p.id) ?? new Set();
                const isOpen = expanded === p.id;
                return (
                  <li key={p.id} className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm">{p.name}</span>
                      <span className="truncate text-[11px] text-muted/60">
                        {[...assigned]
                          .map((tid) => typeName.get(tid))
                          .filter(Boolean)
                          .join(" · ") || "bez typu"}
                      </span>
                      <span className="ml-auto flex items-center gap-2.5">
                        <button
                          onClick={() => setExpanded(isOpen ? null : p.id)}
                          className="transition-quick text-xs text-muted hover:text-brass"
                          aria-expanded={isOpen}
                        >
                          {isOpen ? "Skrýt typy" : "Typy"}
                        </button>
                        {own ? (
                          <button
                            onClick={() => deletePlatform(p.id)}
                            disabled={busy}
                            className="transition-quick text-xs text-muted hover:text-[#D46A5B] disabled:opacity-50"
                          >
                            Smazat
                          </button>
                        ) : (
                          <span className="text-[11px] text-muted/60">výchozí</span>
                        )}
                      </span>
                    </div>
                    {isOpen && (
                      <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                        {data.mediaTypes.map((t) => {
                          const active = assigned.has(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => toggleAssignment(p.id, t.id)}
                              disabled={busy}
                              aria-pressed={active}
                              className={`transition-quick rounded-md border px-2 py-0.5 text-xs disabled:opacity-50 ${
                                active
                                  ? "border-brass/70 text-brass"
                                  : "border-line text-muted hover:border-muted/60 hover:text-ink"
                              }`}
                            >
                              {t.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-card p-4">
        <h3 className="text-base font-bold tracking-tight">Nová platforma</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Název (Nintendo Switch 3…)"
            aria-label="Název nové platformy"
            className={`${settingsInput} w-56`}
          />
          <input
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            placeholder="Skupina"
            aria-label="Skupina platformy"
            list="platform-groups"
            className={`${settingsInput} w-40`}
          />
          <datalist id="platform-groups">
            {existingGroups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
        <p className="mb-1.5 mt-3 text-xs text-muted">Zobrazovat u typů:</p>
        <div className="flex flex-wrap gap-1.5">
          {data.mediaTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => toggleNewType(t.id)}
              aria-pressed={newTypeIds.has(t.id)}
              className={`transition-quick rounded-md border px-2 py-0.5 text-xs ${
                newTypeIds.has(t.id)
                  ? "border-brass/70 text-brass"
                  : "border-line text-muted hover:border-muted/60 hover:text-ink"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <button
          onClick={addPlatform}
          disabled={busy || !name.trim()}
          className="transition-quick mt-3 rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-bg hover:bg-brass-deep disabled:opacity-50"
        >
          Přidat platformu
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-[#D46A5B]">{error}</p>}
    </div>
  );
}
