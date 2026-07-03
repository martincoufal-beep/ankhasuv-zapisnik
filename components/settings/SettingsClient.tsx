"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Genre, MediaType, Platform, Status } from "@/lib/types";
import SettingsTypes from "./SettingsTypes";
import SettingsPlatforms from "./SettingsPlatforms";
import SettingsStatuses from "./SettingsStatuses";
import SettingsBackup from "./SettingsBackup";

export interface Mtp {
  media_type_id: string;
  platform_id: string;
  user_id: string | null;
}

export interface SettingsData {
  userId: string;
  mediaTypes: MediaType[];
  platforms: Platform[];
  statuses: Status[];
  genres: Genre[];
  mtp: Mtp[];
}

const TABS = [
  { key: "typy", label: "Typy médií" },
  { key: "platformy", label: "Platformy" },
  { key: "stavy", label: "Stavy" },
  { key: "zaloha", label: "Záloha" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function SettingsClient() {
  const [tab, setTab] = useState<TabKey>("typy");
  const [data, setData] = useState<SettingsData | null>(null);
  const [loadError, setLoadError] = useState(false);

  const reload = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoadError(true);
      return;
    }
    const [mt, pl, st, ge, mtp] = await Promise.all([
      supabase.from("media_types").select("*").order("sort"),
      supabase.from("platforms").select("*").order("sort"),
      supabase.from("statuses").select("*").order("sort"),
      supabase.from("genres").select("*").order("name"),
      supabase.from("media_type_platforms").select("*"),
    ]);
    if (mt.error || pl.error || st.error || ge.error || mtp.error) {
      setLoadError(true);
      return;
    }
    setData({
      userId: user.id,
      mediaTypes: mt.data as MediaType[],
      platforms: pl.data as Platform[],
      statuses: st.data as Status[],
      genres: ge.data as Genre[],
      mtp: mtp.data as Mtp[],
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (loadError) {
    return (
      <div className="max-w-md py-10">
        <p className="text-xl font-bold tracking-tight">
          Nastavení se nepodařilo otevřít.
        </p>
        <p className="mt-2 leading-relaxed text-muted">
          Číselníky se nenačetly — zkontroluj připojení a obnov stránku.
        </p>
      </div>
    );
  }

  if (!data) {
    return <p className="py-10 text-sm text-muted">Otevírám nastavení…</p>;
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Sekce nastavení"
        className="flex flex-wrap gap-1.5 border-b border-line pb-3"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`transition-quick rounded-md border px-3 py-1.5 text-sm ${
              tab === t.key
                ? "border-brass/70 text-brass"
                : "border-line text-muted hover:border-muted/60 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "typy" && <SettingsTypes data={data} onChanged={reload} />}
        {tab === "platformy" && (
          <SettingsPlatforms data={data} onChanged={reload} />
        )}
        {tab === "stavy" && <SettingsStatuses data={data} onChanged={reload} />}
        {tab === "zaloha" && <SettingsBackup data={data} onChanged={reload} />}
      </div>
    </div>
  );
}
