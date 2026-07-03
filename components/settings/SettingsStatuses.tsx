"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StatusMeaning } from "@/lib/types";
import { MEANING_LABELS } from "@/lib/types";
import type { SettingsData } from "./SettingsClient";
import { settingsInput } from "./SettingsTypes";

const MEANING_COLORS: Record<StatusMeaning, string> = {
  wishlist: "#8B9BB4",
  owned: "#C2A75A",
  in_progress: "#5B8DD4",
  completed: "#6FA85C",
  completed_100: "#E8B54B",
  paused: "#9A9DAC",
  dropped: "#D46A5B",
  repeating: "#9B7FD4",
  waiting: "#4FB8A8",
  ongoing: "#4F9BB8",
  archived: "#6B6E7B",
};

export default function SettingsStatuses({
  data,
  onChanged,
}: {
  data: SettingsData;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [label, setLabel] = useState("");
  const [meaning, setMeaning] = useState<StatusMeaning>("wishlist");
  const [typeId, setTypeId] = useState<string>(""); // "" = globální
  const [color, setColor] = useState(MEANING_COLORS.wishlist);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { label: string; color: string }>>({});

  const sections = useMemo(() => {
    const globalStatuses = data.statuses.filter((s) => s.media_type_id === null);
    const byType = data.mediaTypes
      .map((t) => ({
        key: t.id,
        title: t.name,
        color: t.color,
        statuses: data.statuses.filter((s) => s.media_type_id === t.id),
      }))
      .filter((sec) => sec.statuses.length > 0);
    return [
      { key: "global", title: "Globální (fallback pro všechny typy)", color: "#D4A75A", statuses: globalStatuses },
      ...byType,
    ];
  }, [data.statuses, data.mediaTypes]);

  async function addStatus() {
    if (!label.trim()) return;
    setBusy(true);
    setError(null);
    const siblings = data.statuses.filter(
      (s) => (s.media_type_id ?? "") === typeId
    );
    const { error } = await supabase.from("statuses").insert({
      user_id: data.userId,
      media_type_id: typeId || null,
      meaning,
      label: label.trim(),
      color,
      sort: Math.max(...siblings.map((s) => s.sort), 0) + 10,
    });
    setBusy(false);
    if (error) {
      setError("Stav se nepodařilo přidat.");
      return;
    }
    setLabel("");
    onChanged();
  }

  async function saveStatus(id: string) {
    const edit = edits[id];
    if (!edit) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("statuses")
      .update({ label: edit.label.trim(), color: edit.color })
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

  async function deleteStatus(id: string) {
    setBusy(true);
    setError(null);
    // items.status_id má on delete set null — mazání je bezpečné
    const { error } = await supabase.from("statuses").delete().eq("id", id);
    setBusy(false);
    if (error) {
      setError("Smazání se nepovedlo.");
      return;
    }
    onChanged();
  }

  return (
    <div>
      <div className="space-y-4">
        {sections.map((sec) => (
          <div key={sec.key}>
            <h3 className="mb-1.5 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted/70">
              <span
                className="h-2.5 w-1 rounded-full"
                style={{ backgroundColor: sec.color }}
                aria-hidden
              />
              {sec.title}
            </h3>
            <ul className="divide-y divide-line rounded-lg border border-line bg-card">
              {sec.statuses.map((s) => {
                const own = s.user_id !== null;
                const edit = edits[s.id];
                return (
                  <li key={s.id} className="flex flex-wrap items-center gap-2.5 px-4 py-2">
                    <span
                      className="h-0.5 w-3.5 shrink-0 rounded-full"
                      style={{ backgroundColor: edit?.color ?? s.color ?? "#9195A6" }}
                      aria-hidden
                    />
                    {own && edit ? (
                      <>
                        <input
                          value={edit.label}
                          onChange={(e) =>
                            setEdits({ ...edits, [s.id]: { ...edit, label: e.target.value } })
                          }
                          aria-label="Label stavu"
                          className={`${settingsInput} w-52`}
                        />
                        <input
                          type="color"
                          value={edit.color}
                          onChange={(e) =>
                            setEdits({ ...edits, [s.id]: { ...edit, color: e.target.value } })
                          }
                          aria-label="Barva stavu"
                          className="h-8 w-10 cursor-pointer rounded border border-line bg-bg"
                        />
                        <button
                          onClick={() => saveStatus(s.id)}
                          disabled={busy || !edit.label.trim()}
                          className="transition-quick rounded-md bg-brass px-2.5 py-1 text-xs font-medium text-bg hover:bg-brass-deep disabled:opacity-50"
                        >
                          Uložit
                        </button>
                        <button
                          onClick={() =>
                            setEdits((prev) => {
                              const next = { ...prev };
                              delete next[s.id];
                              return next;
                            })
                          }
                          className="transition-quick text-xs text-muted hover:text-ink"
                        >
                          Zrušit
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm">{s.label}</span>
                        <span className="text-[11px] text-muted/60">
                          {MEANING_LABELS[s.meaning]}
                        </span>
                      </>
                    )}
                    <span className="ml-auto flex items-center gap-2.5">
                      {own ? (
                        !edit && (
                          <>
                            <button
                              onClick={() =>
                                setEdits({
                                  ...edits,
                                  [s.id]: {
                                    label: s.label,
                                    color: s.color ?? MEANING_COLORS[s.meaning],
                                  },
                                })
                              }
                              className="transition-quick text-xs text-muted hover:text-brass"
                            >
                              Upravit
                            </button>
                            <button
                              onClick={() => deleteStatus(s.id)}
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
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-card p-4">
        <h3 className="text-base font-bold tracking-tight">Nový stav</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            aria-label="Typ média stavu"
            className={settingsInput}
          >
            <option value="">Globální</option>
            {data.mediaTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            value={meaning}
            onChange={(e) => {
              const m = e.target.value as StatusMeaning;
              setMeaning(m);
              setColor(MEANING_COLORS[m]);
            }}
            aria-label="Význam stavu"
            className={settingsInput}
          >
            {(Object.keys(MEANING_LABELS) as StatusMeaning[]).map((m) => (
              <option key={m} value={m}>
                {MEANING_LABELS[m]}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (Dohráno na nightmare…)"
            aria-label="Label nového stavu"
            className={`${settingsInput} w-56`}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            aria-label="Barva nového stavu"
            className="h-9 w-11 cursor-pointer rounded border border-line bg-bg"
          />
          <button
            onClick={addStatus}
            disabled={busy || !label.trim()}
            className="transition-quick rounded-md bg-brass px-3 py-1.5 text-sm font-medium text-bg hover:bg-brass-deep disabled:opacity-50"
          >
            Přidat stav
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted/70">
          Význam drží statistiky pohromadě napříč typy („Dokončeno“ sčítá
          dohráno, přečteno i dokoukáno) — label je to, co uvidíš v aplikaci.
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-[#D46A5B]">{error}</p>}
    </div>
  );
}
