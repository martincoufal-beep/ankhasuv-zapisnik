"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ImageRow } from "@/lib/types";
import { imageUrl } from "@/lib/helpers";
import { compressToWebp } from "@/lib/compressImage";
import CoverSearch, { type CoverCandidate } from "./CoverSearch";

export default function ImageManager({
  itemId,
  userId,
  itemTitle,
  typeSlug,
  initialImages,
}: {
  itemId: string;
  userId: string;
  itemTitle: string;
  typeSlug: string | null | undefined;
  initialImages: ImageRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<ImageRow[]>(initialImages);
  const [urlValue, setUrlValue] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // popis probíhající akce
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());

  function done(next: ImageRow[]) {
    setImages(next);
    setBusy(null);
    router.refresh(); // překreslí serverovou hlavičku detailu (velká obálka)
  }

  function fail(message: string) {
    setBusy(null);
    setError(message);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy("Nahrávám obrázek…");
    try {
      const added: ImageRow[] = [];
      for (const file of Array.from(files)) {
        const { blob, width, height } = await compressToWebp(file);
        const path = `${userId}/${itemId}/${crypto.randomUUID()}.webp`;
        const up = await supabase.storage
          .from("covers")
          .upload(path, blob, { contentType: "image/webp" });
        if (up.error) throw up.error;

        const { data, error } = await supabase
          .from("images")
          .insert({
            item_id: itemId,
            user_id: userId,
            kind: "cover",
            source: "upload",
            storage_path: path,
            is_primary: images.length + added.length === 0,
            width,
            height,
          })
          .select()
          .single();
        if (error) throw error;
        added.push(data as ImageRow);
      }
      done([...images, ...added]);
    } catch (e) {
      console.error(e);
      fail("Obrázek se nepodařilo nahrát. Zkus jiný soubor, nebo to zopakuj.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePickCandidate(candidate: CoverCandidate) {
    setError(null);
    setBusy("Ukládám obálku…");
    const { data, error } = await supabase
      .from("images")
      .insert({
        item_id: itemId,
        user_id: userId,
        kind: "cover",
        source: "api",
        external_url: candidate.fullUrl ?? candidate.thumbUrl,
        source_name: candidate.source,
        is_primary: images.length === 0,
      })
      .select()
      .single();
    if (error) {
      console.error(error);
      fail("Obálku se nepodařilo uložit, zkus to znovu.");
      return;
    }
    done([...images, data as ImageRow]);
  }

  async function handleAddUrl() {
    const url = urlValue.trim();
    if (!url) return;
    setError(null);
    setBusy("Přidávám odkaz…");
    const { data, error } = await supabase
      .from("images")
      .insert({
        item_id: itemId,
        user_id: userId,
        kind: "cover",
        source: "url",
        external_url: url,
        is_primary: images.length === 0,
      })
      .select()
      .single();
    if (error) {
      console.error(error);
      fail("Odkaz se nepodařilo uložit. Zkontroluj, že jde o platnou URL.");
      return;
    }
    setUrlValue("");
    done([...images, data as ImageRow]);
  }

  async function handleSetPrimary(img: ImageRow) {
    setError(null);
    setBusy("Měním hlavní obálku…");
    const current = images.find((i) => i.is_primary);
    if (current && current.id !== img.id) {
      const off = await supabase
        .from("images")
        .update({ is_primary: false })
        .eq("id", current.id);
      if (off.error) {
        console.error(off.error);
        fail("Změna hlavní obálky se nepovedla, zkus to znovu.");
        return;
      }
    }
    const on = await supabase
      .from("images")
      .update({ is_primary: true })
      .eq("id", img.id);
    if (on.error) {
      console.error(on.error);
      fail("Změna hlavní obálky se nepovedla, zkus to znovu.");
      return;
    }
    done(images.map((i) => ({ ...i, is_primary: i.id === img.id })));
  }

  async function handleDelete(img: ImageRow) {
    setError(null);
    setBusy("Mažu obrázek…");
    // U uploadů smazat i soubor ze Storage, ať nevznikají sirotci
    if (img.storage_path) {
      const rm = await supabase.storage.from("covers").remove([img.storage_path]);
      if (rm.error) console.error(rm.error);
    }
    const { error } = await supabase.from("images").delete().eq("id", img.id);
    if (error) {
      console.error(error);
      fail("Smazání se nepovedlo, zkus to znovu.");
      return;
    }
    let next = images.filter((i) => i.id !== img.id);
    // Po smazání hlavní obálky povýšit první zbývající obrázek
    if (img.is_primary && next.length > 0) {
      const promote = await supabase
        .from("images")
        .update({ is_primary: true })
        .eq("id", next[0].id);
      if (!promote.error) {
        next = next.map((i, idx) => ({ ...i, is_primary: idx === 0 }));
      }
    }
    done(next);
  }

  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold tracking-tight">Obrázky</h2>

      {images.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Zatím bez obálky — karta v knihovně nese iniciály a barvu typu.
          Najdi ji online, nahraj vlastní, nebo vlož odkaz.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {images.map((img) => {
            const src = imageUrl(img);
            return (
              <figure
                key={img.id}
                className="w-28 overflow-hidden rounded-md border border-line bg-card"
              >
                <div className="relative aspect-[2/3] bg-bg">
                  {src && !broken.has(img.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      onError={() =>
                        setBroken((prev) => new Set(prev).add(img.id))
                      }
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center px-2 text-center text-[11px] leading-snug text-muted">
                      Obrázek se nenačte — web možná odkaz blokuje.
                    </span>
                  )}
                  {img.is_primary && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-brass px-1.5 py-0.5 text-[10px] font-medium text-bg">
                      hlavní
                    </span>
                  )}
                </div>
                <figcaption className="flex items-center justify-between gap-1 px-1.5 py-1">
                  {!img.is_primary ? (
                    <button
                      onClick={() => handleSetPrimary(img)}
                      disabled={busy !== null}
                      className="transition-quick text-[11px] text-muted hover:text-brass disabled:opacity-50"
                    >
                      Nastavit hlavní
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted/60">
                      {img.source === "upload" ? "nahráno" : "z odkazu"}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(img)}
                    disabled={busy !== null}
                    aria-label="Smazat obrázek"
                    className="transition-quick text-[11px] text-muted hover:text-[#D46A5B] disabled:opacity-50"
                  >
                    Smazat
                  </button>
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-3">
        <CoverSearch
          title={itemTitle}
          typeSlug={typeSlug}
          onPick={handlePickCandidate}
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleUpload(e.target.files)}
            className="hidden"
            id="cover-upload"
          />
          <label
            htmlFor="cover-upload"
            className="btn-accent cursor-pointer rounded-lg px-3.5 py-2 text-sm"
          >
            Nahrát obrázek
          </label>
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddUrl();
              }
            }}
            placeholder="https://… (odkaz na obrázek)"
            aria-label="URL obrázku"
            className="transition-quick w-64 rounded-lg border border-line bg-card px-3.5 py-2 text-sm placeholder:text-muted/60 hover:border-[#34343b] focus:border-brass/60"
          />
          <button
            onClick={handleAddUrl}
            disabled={busy !== null || !urlValue.trim()}
            className="transition-quick rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink disabled:opacity-50"
          >
            Přidat z URL
          </button>
          {busy && <span className="text-sm text-muted">{busy}</span>}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm leading-relaxed text-[#D46A5B]">{error}</p>
      )}
    </section>
  );
}
