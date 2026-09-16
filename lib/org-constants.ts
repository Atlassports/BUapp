/**
 * Client-safe org constants.
 *
 * Kept apart from lib/orgs.ts because that module reaches the database and is
 * server-only; importing it from a form component drags the whole server graph
 * into the browser bundle.
 */
export const ORG_CATEGORIES = [
  "Student organization",
  "Academic club",
  "Cultural club",
  "Greek life",
  "Sports & club team",
  "Performing arts",
  "Media & publication",
  "Service & volunteering",
  "Pre-professional",
  "Student government",
];
