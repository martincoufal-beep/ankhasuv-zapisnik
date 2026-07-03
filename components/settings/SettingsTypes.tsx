"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SettingsData } from "./SettingsClient";

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    // odstranit diakritiku (kombinující znaky U+0300–U+036F)
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export const settingsInput =
  "transition-quick rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-muted/60 hover:border-muted/60";

export default function SettingsTypes({
  data,
  onChanged,
}: {
  data: SettingsData;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#8B8FA3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { name: string; color: string }>>({});

  async function addType() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const base = slugify(name) || "typ";
    const { error } = await supabase.from("media_types").insert({
      user_id: data.userId,
      slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      color,
      field_groups: [],
      sort: Math.max(...data.mediaTypes.map((t) => t.sort), 0) + 10,
    });
    setBusy(false);
    if (error) {
      setError("Typ se nepodařilo přidat. Zkus to znovu.");
      return;
    }
    setName("");
    onChanged();
  }

  async function saveType(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("media_types")
      .update({ name: edit.name.trim(), color: edit.color })
      .eq("id", id);
    setBusy(false);
    if (error) {
      setError("Uložení se nepovedlo.");
      return;
    }
    setEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onChanged();
  }

  async function deleteType(id: string) {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("media_types").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setError(
        "Typ nejde smazat — nejspíš pod ním máš zapsané položky. Nejdřív je přesuň na jiný typ."
      );
      return;
    }
    onChanged();
  }

  return (
    <div>
      <ul className="divide-y divide-line rounded-lg border border-line bg-card">
        {data.mediaTypes.map((t) => {
          const own = t.user_id !== null;
          const edit = edits[t.id];
          return (
            <li key={t.id} className="flex flex-wrap items-center gap-2.5 px-4 py-2.5">
              <span
                className="h-3 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: edit?.color ?? t.color }}
                aria-hidden
              />
              {own && edit ? (
                <>
                  <input
                    value={edit.name}
                    onChange={(e) =>
                      setEdits({ ...edits, [t.id]: { ...edit, name: e.target.value } })
                    }
                    aria-label="Název typu"
                    className={`${settingsInput} w-44`}
                  />
                  <input
                    type="color"
                    value={edit.color}
                    onChange={(e) =>
                      setEdits({ ...edits, [t.id]: { ...edit, color: e.target.value } })
                    }
                    aria-label="Barva typu"
                    className="h-8 w-10 cursor-pointer rounded border border-line bg-bg"
                  />
                  <button
                    onClick={() => saveType(t.id)}
                    disabled={busy || !edit.name.trim()}
                    className="transition-quick rounded-md bg-brass px-2.5 py-1 text-xs font-medium text-bg hover:bg-brass-deep disabled:opacity-50"
                  >
                    Uložit
                  </button>
                  <button
                    onClick={() =>
                      setEdits((prev) => {
                        const next = { ...prev };
                        delete next[t.id];
                        return next;
                      })
                    }
                    className="transition-quick text-xs text-muted hover:text-ink"
                  >
                    Zrušit
                  </button>
                </>
              ) : (
                <span className="text-sm">{t.name}</span>
              )}

              <span className="ml-auto flex items-center gap-2.5">
                {own ? (
                  !edit && (
                    <>
                      <button
                        onClick={() =>
                          setEdits({ ...edits, [t.id]: { name: t.name, color: t.color } })
                        }
                        className="transition-quick text-xs text-muted hover:text-brass"
                      >
                        Upravit
                      </button>
                      <button
                        onClick={() => deleteType(t.id)}
                        disabled={busy}
                        className="transition-quick text-xs text-muted hover:text-[#D46A5B] disabled:opacity-50"
                      >
                        Smazat
                      </button>
                    </>
                  )
                ) : (
                  <span className="text-[11px] text-muted/60">výchozí</span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nový typ (LARP, muzikál…)"
          aria-label="Název nového typu"
          className={`${settingsInput} w-56`}
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          aria-label="Barva nového typu"
          className="h-9 w-11 cursor-pointer rounded border border-line bg-bg"
        />
        <button
          onClick={addType}
          disabled={busy || !name.trim()}
          className="transition-quick rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-bg hover:bg-brass-deep disabled:opacity-50"
        >
          Přidat typ
        </button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted/70">
        Nový typ začíná s globálními stavy a bez typových polí — stavy mu
        přiřadíš v záložce Stavy, platformy v záložce Platformy.
      </p>
      {error && <p className="mt-2 text-sm text-[#D46A5B]">{error}</p>}
    </div>
  );
}
