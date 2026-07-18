import { House, TrendingUp, Utensils, Dumbbell } from "lucide-react";

/** Shared by the server route (slug validation) and the client shell. */
export const TABS = [
  { id: "today", slug: "", label: "Today", icon: House, path: "/" },
  { id: "weight", slug: "weight", label: "Weight", icon: TrendingUp, path: "/weight" },
  { id: "food", slug: "food", label: "Food", icon: Utensils, path: "/food" },
  { id: "lift", slug: "lift", label: "Lift", icon: Dumbbell, path: "/lift" },
] as const;

export type TabId = (typeof TABS)[number]["id"];
