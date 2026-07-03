"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export default function DeleteItemButton({
  itemId,
  title,
}: {
  itemId: string;
  title: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setError(false);
    const supabase = createClient();
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (error) {
      setDeleting(false);
      setError(true);
      return;
    }
    router.push("/");
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="transition-quick flex items-center gap-1.5 text-sm font-medium text-red/80 hover:text-red"
      >
        <Icon name="trash" size={14} />
        Odebrat ze zápisníku
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Odebrat „{title}“ nadobro?</span>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="transition-quick rounded-lg bg-red px-3 py-1.5 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-60"
      >
        {deleting ? "Mažu…" : "Ano, odebrat"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        disabled={deleting}
        className="transition-quick rounded-lg border border-line px-3 py-1.5 font-medium text-muted hover:text-ink"
      >
        Ponechat
      </button>
      {error && (
        <span className="text-red">Smazání se nepovedlo, zkus to znovu.</span>
      )}
    </span>
  );
}
