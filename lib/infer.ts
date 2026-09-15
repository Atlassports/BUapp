import { CATEGORIES, type CategoryId, type TransportId } from "./taxonomy";
import { PLACES } from "./geo";

/**
 * Post-time inference. This is a transparent keyword model, not a language
 * model — it runs instantly, offline, and every guess is shown as an editable
 * suggestion rather than applied silently. Swapping in a real model later only
 * has to satisfy this same interface.
 */

export type Inference = {
  category: CategoryId;
  tags: string[];
  estMinutes: number;
  placeId: string | null;
  transportRequired: TransportId | null;
  isRemote: boolean;
  urgentHours: number | null;
};

const CATEGORY_HINTS: Array<[CategoryId, RegExp, string[]]> = [
  ["errands", /\b(package|mail ?room|amazon|pick ?up|grocery|groceries|laundry|return|line|cvs|prescription|target|trader joe)/i, ["Package pickup"]],
  ["errands", /\b(food|doordash|chipotle|coffee|dunkin|starbucks|lunch|dinner)\b/i, ["Food pickup"]],
  ["moving", /\b(move|moving|couch|furniture|boxes|mattress|desk|dresser|heavy|carry|lift|ikea|assemble)/i, ["Heavy lifting"]],
  ["moving", /\b(clean|cleaning|vacuum|tidy|dishes)\b/i, ["Clean room/apartment"]],
  ["academic", /\b(tutor|tutoring|study|homework help|explain|orgo|calc|chem|physics|exam prep|essay feedback|proofread)/i, ["Tutoring"]],
  ["creative", /\b(photo|photograph|video|film|edit|tiktok|reel|design|logo|flyer|poster|thumbnail|instagram)/i, ["Video editing"]],
  ["tech", /\b(website|web ?site|code|coding|python|react|excel|spreadsheet|laptop|wifi|printer|setup|debug|troubleshoot)/i, ["Coding"]],
  ["personal", /\b(dog|cat|pet|walk my|plant|water my|babysit)/i, ["Pet sitting"]],
  ["campus", /\b(club|event setup|tabling|flyer|student org|e-?board|rush|gbm)/i, ["Event setup"]],
  ["transportation", /\b(airport|logan|ride|drive me|carpool|drop off|pick me up|u-?haul)/i, ["Airport ride"]],
];

const TIME_HINTS: Array<[RegExp, number]> = [
  [/\b(asap|right now|next 30|urgent|immediately)\b/i, 1],
  [/\b(in an hour|within an hour|next hour)\b/i, 1],
  [/\b(tonight|this evening|by \d{1,2} ?pm)\b/i, 6],
  [/\btomorrow\b/i, 24],
  [/\b(this weekend|saturday|sunday)\b/i, 72],
];

const DURATION_HINTS: Array<[RegExp, number]> = [
  [/\b(\d{1,3})\s*(min|minute)s?\b/i, 0], // captured below
  [/\bquick|fast|5 ?min|real quick\b/i, 15],
  [/\ball day\b/i, 300],
];

export function inferFromTitle(text: string): Inference {
  const t = text.trim();

  let category: CategoryId = "other";
  const tags: string[] = [];
  for (const [cat, pattern, suggested] of CATEGORY_HINTS) {
    if (pattern.test(t)) {
      category = cat;
      for (const s of suggested) if (!tags.includes(s)) tags.push(s);
      break;
    }
  }

  const isRemote = /\b(remote|zoom|online|virtual|over the phone)\b/i.test(t);

  const place = PLACES.find((p) => {
    const key = p.name.toLowerCase().split(" (")[0];
    return key.length > 4 && t.toLowerCase().includes(key);
  });

  let transportRequired: TransportId | null = null;
  if (/\b(car|drive|driving|vehicle|truck|suv|u-?haul|airport)\b/i.test(t)) transportRequired = "car";
  else if (/\b(bike|bicycle)\b/i.test(t)) transportRequired = "bike";
  else if (/\b(t |mbta|green line|subway)\b/i.test(t)) transportRequired = "mbta";
  else if (!isRemote && category === "errands") transportRequired = "walk";

  let urgentHours: number | null = null;
  for (const [pattern, hours] of TIME_HINTS) {
    if (pattern.test(t)) {
      urgentHours = hours;
      break;
    }
  }

  let estMinutes = CATEGORIES.find((c) => c.id === category)?.typicalMinutes ?? 45;
  const explicit = t.match(/\b(\d{1,3})\s*(min|minute)s?\b/i);
  if (explicit) estMinutes = Math.min(480, Number(explicit[1]));
  const hoursMatch = t.match(/\b(\d{1,2})\s*(hr|hour)s?\b/i);
  if (hoursMatch) estMinutes = Math.min(480, Number(hoursMatch[1]) * 60);
  for (const [pattern, mins] of DURATION_HINTS) {
    if (mins && pattern.test(t)) estMinutes = mins;
  }

  return {
    category,
    tags,
    estMinutes,
    placeId: isRemote ? "remote" : (place?.id ?? null),
    transportRequired: isRemote ? null : transportRequired,
    isRemote,
    urgentHours,
  };
}

/** Quick deadline presets, resolved against "now" at render time. */
export const DEADLINE_PRESETS = [
  { id: "1h", label: "Within an hour", hours: 1 },
  { id: "3h", label: "Next 3 hours", hours: 3 },
  { id: "tonight", label: "Tonight", hours: 8 },
  { id: "tomorrow", label: "Tomorrow", hours: 24 },
  { id: "weekend", label: "This weekend", hours: 72 },
  { id: "flexible", label: "Flexible", hours: null },
];
