/**
 * The classification system. Categories are deliberately coarse; the real
 * filtering power comes from tags, transportation and distance.
 */

export type CategoryId =
  | "errands"
  | "moving"
  | "academic"
  | "creative"
  | "tech"
  | "personal"
  | "campus"
  | "transportation"
  | "other";

export type Category = {
  id: CategoryId;
  label: string;
  emoji: string;
  /** Subcategories double as the tag suggestions shown while posting. */
  subcategories: string[];
  /** Median completion time in minutes, used to seed price suggestions. */
  typicalMinutes: number;
  /** Campus-typical rate in dollars per hour, used by the pricing helper. */
  typicalHourly: number;
};

export const CATEGORIES: Category[] = [
  {
    id: "errands",
    label: "Errands",
    emoji: "🎒",
    typicalMinutes: 25,
    typicalHourly: 26,
    subcategories: [
      "Package pickup",
      "Grocery pickup",
      "Food pickup",
      "Laundry",
      "Returns",
      "Waiting in line",
      "Prescription pickup",
    ],
  },
  {
    id: "moving",
    label: "Moving & Physical",
    emoji: "📦",
    typicalMinutes: 90,
    typicalHourly: 30,
    subcategories: [
      "Move furniture",
      "Carry boxes",
      "Dorm move-in",
      "Dorm move-out",
      "Assemble furniture",
      "Clean room/apartment",
      "Heavy lifting",
    ],
  },
  {
    id: "academic",
    label: "Academic",
    emoji: "📚",
    typicalMinutes: 60,
    typicalHourly: 32,
    subcategories: [
      "Tutoring",
      "Study help",
      "Language practice",
      "Study partner",
      "Proofreading",
      "Exam prep",
    ],
  },
  {
    id: "creative",
    label: "Creative",
    emoji: "🎬",
    typicalMinutes: 120,
    typicalHourly: 35,
    subcategories: [
      "Photography",
      "Videography",
      "Video editing",
      "Graphic design",
      "Social media",
      "Music",
      "Illustration",
    ],
  },
  {
    id: "tech",
    label: "Tech",
    emoji: "💻",
    typicalMinutes: 75,
    typicalHourly: 38,
    subcategories: [
      "Website help",
      "Coding",
      "Computer setup",
      "Troubleshooting",
      "Data entry",
      "Spreadsheets",
    ],
  },
  {
    id: "personal",
    label: "Personal",
    emoji: "🐾",
    typicalMinutes: 60,
    typicalHourly: 25,
    subcategories: [
      "Pet sitting",
      "Dog walking",
      "Plant watering",
      "Event help",
      "Personal assistant",
    ],
  },
  {
    id: "campus",
    label: "Campus",
    emoji: "🎓",
    typicalMinutes: 120,
    typicalHourly: 24,
    subcategories: [
      "Event setup",
      "Club work",
      "Flyer distribution",
      "Student org work",
      "Tabling",
      "Photography for club",
    ],
  },
  {
    id: "transportation",
    label: "Transportation",
    emoji: "🚗",
    typicalMinutes: 60,
    typicalHourly: 34,
    subcategories: [
      "Airport ride",
      "Furniture pickup",
      "Package transportation",
      "Carpool",
      "Store run",
    ],
  },
  {
    id: "other",
    label: "Other",
    emoji: "✨",
    typicalMinutes: 45,
    typicalHourly: 26,
    subcategories: [],
  },
];

export const CATEGORY_BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function categoryOf(id: string): Category {
  return CATEGORY_BY_ID.get(id as CategoryId) ?? CATEGORIES[CATEGORIES.length - 1];
}

/* ------------------------------------------------------------------ */
/* Transportation                                                      */
/* ------------------------------------------------------------------ */

export type TransportId = "walk" | "bike" | "mbta" | "car" | "moto" | "rideshare";

export type Transport = {
  id: TransportId;
  label: string;
  emoji: string;
  /** How far someone with this mode will comfortably travel, in miles. */
  comfortableRadius: number;
  /** Average travel speed in mph, used for the "can you make it" math. */
  speed: number;
};

export const TRANSPORT: Transport[] = [
  { id: "walk", label: "Walk", emoji: "🚶", comfortableRadius: 1.2, speed: 3 },
  { id: "bike", label: "Bike", emoji: "🚲", comfortableRadius: 4, speed: 10 },
  { id: "mbta", label: "MBTA", emoji: "🚇", comfortableRadius: 12, speed: 12 },
  { id: "car", label: "Car", emoji: "🚗", comfortableRadius: 40, speed: 20 },
  { id: "moto", label: "Motorcycle", emoji: "🏍️", comfortableRadius: 40, speed: 22 },
  { id: "rideshare", label: "Uber/Lyft", emoji: "🛺", comfortableRadius: 25, speed: 18 },
];

export const TRANSPORT_BY_ID = new Map(TRANSPORT.map((t) => [t.id, t]));

/** Modes that can actually satisfy a task requiring `required`. */
export function transportSatisfies(owned: TransportId[], required: TransportId | null): boolean {
  if (!required) return true;
  if (owned.includes(required)) return true;
  // A car covers anything a bike or walk could do; rideshare covers car errands
  // that don't need cargo space, so we keep that one strict.
  if (required === "walk") return owned.length > 0;
  if (required === "bike") return owned.some((o) => o === "car" || o === "moto");
  if (required === "mbta") return owned.some((o) => o === "car" || o === "rideshare");
  return false;
}

/** The furthest a user would reasonably travel given everything they own. */
export function reachOf(owned: TransportId[]): number {
  return owned.reduce((max, id) => {
    const t = TRANSPORT_BY_ID.get(id);
    return t ? Math.max(max, t.comfortableRadius) : max;
  }, 0.5);
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const SKILL_SUGGESTIONS = [
  "Video editing",
  "Photography",
  "Graphic design",
  "Web development",
  "Chemistry",
  "Organic chemistry",
  "Calculus",
  "Physics",
  "Statistics",
  "Spanish",
  "Mandarin",
  "Writing",
  "Heavy lifting",
  "Furniture assembly",
  "Cooking",
  "Pet care",
  "Social media",
  "Excel",
  "Python",
  "Music production",
];
