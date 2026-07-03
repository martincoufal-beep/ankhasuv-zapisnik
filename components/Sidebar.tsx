"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Icon } from "./icons";

const NAV = [
  { href: "/", label: "Přehled", icon: "home" },
  { href: "/knihovna", label: "Knihovna", icon: "grid" },
  { href: "/knihovna?stav=rozpracovano", label: "Rozpracováno", icon: "play" },
  { href: "/knihovna?stav=dokonceno", label: "Dokončeno", icon: "check" },
  { href: "/knihovna?stav=backlog", label: "Backlog", icon: "stack" },
  { href: "/statistiky", label: "Statistiky", icon: "chart" },
  { href: "/nastaveni", label: "Nastavení", icon: "settings" },
];

function isActive(href: string, pathname: string, stav: string | null) {
  const [path, query] = href.split("?");
  if (path !== pathname) return false;
  const wantStav = query ? new URLSearchParams(query).get("stav") : null;
  if (path === "/knihovna") return (stav ?? null) === wantStav;
  return true;
}

function NavLinks({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stav = searchParams.get("stav");

  if (variant === "bottom") {
    const items = [NAV[0], NAV[2], null, NAV[4], NAV[6]];
    return (
      <>
        {items.map((item, i) =>
          item === null ? (
            <Link
              key="add"
              href="/pridat"
              aria-label="Přidat položku"
              className="btn-accent -mt-5 flex h-13 w-13 items-center justify-center justify-self-center rounded-full text-2xl font-light"
              style={{ height: 52, width: 52 }}
            >
              +
            </Link>
          ) : (
            <Link
              key={i}
              href={item.href}
              className={`transition-quick flex flex-col items-center gap-1 py-1 text-[10px] font-medium ${
                isActive(item.href, pathname, stav)
                  ? "text-brass"
                  : "text-muted hover:text-ink"
              }`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          )
        )}
      </>
    );
  }

  return (
    <>
      {NAV.map((item) => {
        const active = isActive(item.href, pathname, stav);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`transition-quick flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
              active
                ? "bg-card text-brass"
                : "text-muted hover:bg-card/70 hover:text-ink"
            }`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export default function Sidebar({ email }: { email?: string | null }) {
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-panel px-3 py-5 md:flex">
        <Link
          href="/"
          className="transition-quick flex items-center gap-2.5 px-3 hover:opacity-90"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brass/15 text-brass">
            <Icon name="logo" size={20} />
          </span>
          <span className="text-[15px] font-bold leading-tight tracking-tight">
            Ankhasův
            <br />
            zápisník
          </span>
        </Link>

        <nav className="mt-7 flex flex-col gap-1" aria-label="Hlavní navigace">
          <Suspense>
            <NavLinks variant="side" />
          </Suspense>
        </nav>

        <div className="mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brass/20 text-xs font-bold uppercase text-brass">
            {(email ?? "?").slice(0, 1)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-ink">
              {email ?? ""}
            </span>
            <span className="block text-[11px] text-muted">
              Knihovna prožitých příběhů
            </span>
          </span>
        </div>
      </aside>

      {/* Mobilní spodní lišta */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 items-center border-t border-line bg-panel/95 px-2 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
        aria-label="Hlavní navigace"
      >
        <Suspense>
          <NavLinks variant="bottom" />
        </Suspense>
      </nav>
    </>
  );
}
