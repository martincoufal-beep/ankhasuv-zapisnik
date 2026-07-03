/** Jednotné stroke ikony (24×24) pro navigaci, typy médií a stat karty. */

const S = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const PATHS: Record<string, React.ReactNode> = {
  home: <path {...S} d="M3 10.5 12 3l9 7.5M5.5 9v11h13V9" />,
  grid: (
    <>
      <rect {...S} x="3" y="3" width="8" height="8" rx="1.5" />
      <rect {...S} x="13" y="3" width="8" height="8" rx="1.5" />
      <rect {...S} x="3" y="13" width="8" height="8" rx="1.5" />
      <rect {...S} x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  play: (
    <>
      <circle {...S} cx="12" cy="12" r="9" />
      <path {...S} d="M10 8.5v7l5.5-3.5z" />
    </>
  ),
  check: (
    <>
      <circle {...S} cx="12" cy="12" r="9" />
      <path {...S} d="m8 12.5 2.8 2.8L16.5 9.5" />
    </>
  ),
  stack: <path {...S} d="M4 7h16M4 12h16M4 17h10" />,
  chart: <path {...S} d="M4 20V10m5.3 10V4m5.4 16v-8m5.3 8V7" />,
  settings: (
    <>
      <circle {...S} cx="12" cy="12" r="3.2" />
      <path
        {...S}
        d="M12 2.8v2.4m0 13.6v2.4M2.8 12h2.4m13.6 0h2.4M5.5 5.5l1.7 1.7m9.6 9.6 1.7 1.7m0-13-1.7 1.7M7.2 16.8l-1.7 1.7"
      />
    </>
  ),
  search: (
    <>
      <circle {...S} cx="11" cy="11" r="7" />
      <path {...S} d="m16.5 16.5 4 4" />
    </>
  ),
  logo: (
    <>
      <path {...S} d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
      <path {...S} d="M5 16.5A2.5 2.5 0 0 1 7.5 14H19M9 4v10" />
    </>
  ),
  trophy: (
    <>
      <path {...S} d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path {...S} d="M8 5H5a3 3 0 0 0 3 4M16 5h3a3 3 0 0 1-3 4M12 13v4m-3.5 3h7M12 17l-2 3m2-3 2 3" />
    </>
  ),
  clock: (
    <>
      <circle {...S} cx="12" cy="12" r="9" />
      <path {...S} d="M12 7v5l3.5 2" />
    </>
  ),
  star: (
    <path
      {...S}
      d="M12 3.5 14.6 9l5.9.7-4.4 4 1.2 5.8L12 16.6l-5.3 2.9 1.2-5.8-4.4-4L9.4 9z"
    />
  ),
  box: (
    <>
      <path {...S} d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7z" />
      <path {...S} d="M4 8.5 12 13l8-4.5M12 13v7" />
    </>
  ),
  trash: (
    <path
      {...S}
      d="M5 7h14M9.5 7V5h5v2m-8 0 .8 12.5a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7M10 11v5m4-5v5"
    />
  ),
  external: <path {...S} d="M9 5h10v10M19 5 8 16M5 9v10h10" />,
  image: (
    <>
      <rect {...S} x="3.5" y="5" width="17" height="14" rx="2" />
      <circle {...S} cx="9" cy="10" r="1.6" />
      <path {...S} d="m5 17 4.5-4 3 2.6L16 12l4 4.5" />
    </>
  ),
  // ---- typy médií ----
  gamepad: (
    <>
      <path
        {...S}
        d="M7 8h10a4.5 4.5 0 0 1 4.4 5.4l-.7 3.3a2.6 2.6 0 0 1-4.6 1L14.6 16H9.4l-1.5 1.7a2.6 2.6 0 0 1-4.6-1l-.7-3.3A4.5 4.5 0 0 1 7 8z"
      />
      <path {...S} d="M8 11v3m-1.5-1.5h3M15.5 11.3h.01M17.5 13.3h.01" />
    </>
  ),
  film: (
    <>
      <rect {...S} x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path {...S} d="M7.5 4.5v15m9-15v15M3.5 9h4m9 0h4m-17 6h4m9 0h4" />
    </>
  ),
  tv: (
    <>
      <rect {...S} x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path {...S} d="m9 3 3 3.5L15 3" />
    </>
  ),
  book: (
    <>
      <path {...S} d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4z" />
      <path {...S} d="M5 16.5A2.5 2.5 0 0 1 7.5 14H19" />
    </>
  ),
  headphones: (
    <>
      <path {...S} d="M4.5 14v-2a7.5 7.5 0 0 1 15 0v2" />
      <rect {...S} x="4" y="14" width="4" height="6" rx="1.5" />
      <rect {...S} x="16" y="14" width="4" height="6" rx="1.5" />
    </>
  ),
  bookOpen: (
    <>
      <path
        {...S}
        d="M12 6.5C10.5 5 8.5 4.5 5.5 4.5H3.5v13h2c3 0 5 .5 6.5 2 1.5-1.5 3.5-2 6.5-2h2v-13h-2c-3 0-5 .5-6.5 2z"
      />
      <path {...S} d="M12 6.5v13" />
    </>
  ),
  mic: (
    <>
      <rect {...S} x="9.5" y="3.5" width="5" height="10" rx="2.5" />
      <path {...S} d="M6 11a6 6 0 0 0 12 0M12 17v3.5m-3 0h6" />
    </>
  ),
  dice: (
    <>
      <rect {...S} x="4" y="4" width="16" height="16" rx="3" />
      <path {...S} d="M9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01" />
    </>
  ),
  youtube: (
    <>
      <rect {...S} x="3" y="6" width="18" height="12" rx="3" />
      <path {...S} d="M10.5 9.5v5l4.5-2.5z" />
    </>
  ),
  file: (
    <>
      <path {...S} d="M6.5 3.5h7L18.5 8.5v12h-12v-17z" />
      <path {...S} d="M13 3.5V9h5.5M9 13h6M9 16.5h6" />
    </>
  ),
  cap: (
    <>
      <path {...S} d="m12 4 10 4.5L12 13 2 8.5 12 4z" />
      <path {...S} d="M6.5 10.7V15c0 1.4 2.5 3 5.5 3s5.5-1.6 5.5-3v-4.3M22 8.5V14" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden>
      {PATHS[name] ?? <circle {...S} cx="12" cy="12" r="7" />}
    </svg>
  );
}

/** Ikona podle slugu typu média (fallback: krabice). */
const TYPE_ICON: Record<string, string> = {
  film: "film",
  serial: "tv",
  hra: "gamepad",
  kniha: "book",
  audiokniha: "headphones",
  komiks: "bookOpen",
  manga: "bookOpen",
  "digitalni-komiks": "bookOpen",
  "deskova-hra": "dice",
  podcast: "mic",
  dokument: "tv",
  anime: "tv",
  "youtube-serie": "youtube",
  clanek: "file",
  kurz: "cap",
  ostatni: "box",
};

export function TypeIcon({
  slug,
  size = 15,
  className,
}: {
  slug?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <Icon name={TYPE_ICON[slug ?? ""] ?? "box"} size={size} className={className} />
  );
}
