export interface MediaType {
  id: string;
  user_id: string | null;
  slug: string;
  name: string;
  color: string;
  icon: string | null;
  field_groups: string[];
  default_adapter: string | null;
  sort: number;
}

export interface Platform {
  id: string;
  user_id: string | null;
  name: string;
  group_name: string | null;
  sort: number;
}

export interface MediaTypePlatform {
  media_type_id: string;
  platform_id: string;
}

export type StatusMeaning =
  | "wishlist"
  | "owned"
  | "in_progress"
  | "completed"
  | "completed_100"
  | "paused"
  | "dropped"
  | "repeating"
  | "waiting"
  | "ongoing"
  | "archived";

export interface Status {
  id: string;
  user_id: string | null;
  media_type_id: string | null;
  meaning: StatusMeaning;
  label: string;
  color: string | null;
  sort: number;
}

export interface Genre {
  id: string;
  user_id?: string | null;
  name: string;
}

export interface Tag {
  id: string;
  name: string;
}

export type CustomFieldType =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "date";

export interface CustomField {
  id: string;
  user_id: string | null;
  media_type_id: string;
  name: string;
  field_type: CustomFieldType;
  options: string[] | null;
  is_default: boolean;
  sort: number;
}

export type ImageKind =
  | "cover"
  | "alt_cover"
  | "screenshot"
  | "photo"
  | "background";

export type ImageSource = "upload" | "url" | "api";

export interface ImageRow {
  id: string;
  item_id: string;
  user_id: string;
  kind: ImageKind;
  source: ImageSource;
  storage_path: string | null;
  external_url: string | null;
  source_name: string | null;
  is_primary: boolean;
  width: number | null;
  height: number | null;
  created_at: string;
}

export type LinkKind = "csfd" | "imdb" | "backloggd" | "databazeknih" | "other";

export interface ItemLink {
  id?: string;
  kind: LinkKind;
  url: string;
}

export interface Item {
  id: string;
  user_id: string;
  title: string;
  media_type_id: string;
  status_id: string | null;
  rating: number | null; // 0–10 = 5 hvězd s polovinami
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Položka s načtenými vazbami pro knihovnu a detail. */
export interface ItemWithRelations extends Item {
  media_type: MediaType | null;
  status: Status | null;
  images?: ImageRow[];
  item_platforms?: { platform: { name: string } | null }[];
}

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  csfd: "ČSFD",
  imdb: "IMDb",
  backloggd: "Backloggd",
  databazeknih: "Databáze knih",
  other: "Odkaz",
};

/** Pohledy v navigaci: skupiny významů stavu pro Rozpracováno / Dokončeno / Backlog. */
export const STAV_VIEWS: Record<
  string,
  { title: string; meanings: StatusMeaning[] }
> = {
  rozpracovano: {
    title: "Rozpracováno",
    meanings: ["in_progress", "repeating", "ongoing"],
  },
  dokonceno: { title: "Dokončeno", meanings: ["completed", "completed_100"] },
  backlog: { title: "Backlog", meanings: ["wishlist", "owned"] },
};

/** Souhrnné filtry stavů napříč typy — labely mluví globálně, filtruje se přes meaning. */
export const MEANING_LABELS: Record<StatusMeaning, string> = {
  wishlist: "Plánuji",
  owned: "Vlastním",
  in_progress: "Rozpracováno",
  completed: "Dokončeno",
  completed_100: "Na 100 %",
  paused: "Odloženo",
  dropped: "Opuštěno",
  repeating: "Znovu",
  waiting: "Čekám",
  ongoing: "Průběžně",
  archived: "Archiv",
};
