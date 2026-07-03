"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "./icons";

export default function TopBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K fokusuje hledání
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    router.push(q ? `/knihovna?q=${encodeURIComponent(q)}` : "/knihovna");
  }

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg/85 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="transition-quick flex shrink-0 items-center gap-2 font-bold tracking-tight hover:opacity-90 md:hidden"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brass/15 text-brass">
            <Icon name="logo" size={16} />
          </span>
          Ankhasův zápisník
        </Link>

        <form
          onSubmit={submitSearch}
          role="search"
          className="relative hidden max-w-md flex-1 sm:block"
        >
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat v zápisníku…"
            aria-label="Hledat v zápisníku"
            className="transition-quick w-full rounded-lg border border-line bg-card py-2 pl-10 pr-12 text-sm placeholder:text-muted/60 hover:border-[#34343b] focus:border-brass/60"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-line bg-panel px-1.5 py-0.5 text-[10px] text-muted">
            ⌘K
          </kbd>
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <Link
            href="/pridat"
            className="btn-accent rounded-lg px-3.5 py-2 text-sm"
          >
            + Přidat
          </Link>
          <button
            onClick={signOut}
            className="transition-quick rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:border-[#34343b] hover:text-ink"
          >
            Odhlásit
          </button>
        </div>
      </div>
    </header>
  );
}
