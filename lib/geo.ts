/**
 * Campus geography. Real BU coordinates so distances in the feed are honest —
 * "0.4 mi" has to mean something or the proximity pillar is theater.
 */

export type Place = {
  id: string;
  name: string;
  area: Area;
  lat: number;
  lng: number;
};

export type Area =
  | "Central Campus"
  | "East Campus"
  | "West Campus"
  | "South Campus"
  | "Fenway"
  | "Medical Campus"
  | "Allston"
  | "Brookline"
  | "Off campus"
  | "Remote";

export const PLACES: Place[] = [
  { id: "warren", name: "Warren Towers", area: "Central Campus", lat: 42.3495, lng: -71.1 },
  { id: "gsu", name: "George Sherman Union", area: "Central Campus", lat: 42.3503, lng: -71.1054 },
  { id: "mugar", name: "Mugar Memorial Library", area: "Central Campus", lat: 42.3505, lng: -71.1078 },
  { id: "marsh", name: "Marsh Plaza", area: "Central Campus", lat: 42.3505, lng: -71.1067 },
  { id: "cds", name: "Center for Computing & Data Sciences", area: "Central Campus", lat: 42.3499, lng: -71.103 },
  { id: "questrom", name: "Questrom School of Business", area: "Central Campus", lat: 42.3492, lng: -71.0995 },
  { id: "photonics", name: "Photonics Center", area: "Central Campus", lat: 42.349, lng: -71.103 },
  { id: "myles", name: "Myles Standish Hall", area: "East Campus", lat: 42.3489, lng: -71.0955 },
  { id: "kilachand", name: "Kilachand Hall", area: "East Campus", lat: 42.3488, lng: -71.0947 },
  { id: "danielsen", name: "Danielsen Hall", area: "East Campus", lat: 42.3481, lng: -71.0913 },
  { id: "south", name: "South Campus", area: "South Campus", lat: 42.3475, lng: -71.1025 },
  { id: "west", name: "West Campus (Sleeper/Claflin/Rich)", area: "West Campus", lat: 42.352, lng: -71.1188 },
  { id: "stuvi", name: "StuVi II", area: "West Campus", lat: 42.3536, lng: -71.122 },
  { id: "fitrec", name: "FitRec", area: "West Campus", lat: 42.3527, lng: -71.1178 },
  { id: "agganis", name: "Agganis Arena", area: "West Campus", lat: 42.3523, lng: -71.1175 },
  { id: "fenway", name: "Fenway Campus", area: "Fenway", lat: 42.344, lng: -71.098 },
  { id: "med", name: "BU Medical Campus", area: "Medical Campus", lat: 42.336, lng: -71.0723 },
  { id: "allston-pratt", name: "Allston (Pratt St)", area: "Allston", lat: 42.3556, lng: -71.129 },
  { id: "allston-harvard-ave", name: "Allston (Harvard Ave)", area: "Allston", lat: 42.3534, lng: -71.1318 },
  { id: "brookline", name: "Coolidge Corner, Brookline", area: "Brookline", lat: 42.3429, lng: -71.1212 },
  { id: "backbay", name: "Back Bay", area: "Off campus", lat: 42.3496, lng: -71.0786 },
  { id: "logan", name: "Logan Airport", area: "Off campus", lat: 42.3656, lng: -71.0096 },
  { id: "remote", name: "Remote", area: "Remote", lat: 0, lng: 0 },
];

export const PLACE_BY_ID = new Map(PLACES.map((p) => [p.id, p]));

/** Where the feed measures from when a user hasn't shared precise location. */
export const CAMPUS_CENTER = { lat: 42.3505, lng: -71.1054 };

/**
 * Locations we surface as safe handoff spots: staffed, lit, and busy.
 * Shown on every task with a physical exchange.
 */
export const SAFE_MEETING_SPOTS = [
  "George Sherman Union (main floor)",
  "Mugar Memorial Library lobby",
  "Warren Towers lobby desk",
  "Marsh Plaza",
  "FitRec main entrance",
  "CDS building lobby",
  "Questrom atrium",
];

const EARTH_RADIUS_MI = 3958.8;

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

export function formatDistance(miles: number | null): string {
  if (miles === null) return "Remote";
  if (miles < 0.1) return "Right here";
  return `${miles.toFixed(1)} mi`;
}

export const DISTANCE_FILTERS = [
  { id: "0.5", label: "Under 0.5 mi", miles: 0.5 },
  { id: "1", label: "Under 1 mi", miles: 1 },
  { id: "2", label: "Under 2 mi", miles: 2 },
  { id: "5", label: "Under 5 mi", miles: 5 },
  { id: "any", label: "Anywhere", miles: Infinity },
];
