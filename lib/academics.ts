/**
 * Class years, derived from the date rather than hardcoded.
 *
 * A hardcoded list is wrong the moment a class graduates, and it fails
 * quietly — the app keeps offering a year nobody is anymore, and stops
 * offering the one the incoming class needs.
 */

/** The year the current senior class graduates. */
export function graduatingClass(now = new Date()): number {
  // An academic year runs autumn to spring, so from June onward the senior
  // class is the one graduating next calendar year.
  return now.getMonth() >= 5 ? now.getFullYear() + 1 : now.getFullYear();
}

/** Undergraduate years currently on campus, newest students first. */
export function undergraduateYears(now = new Date()): string[] {
  const senior = graduatingClass(now);
  return [senior + 3, senior + 2, senior + 1, senior].map(String);
}

export const NON_UNDERGRAD_YEARS = ["Grad", "Other"] as const;

/** Everything the class-year picker offers. */
export function classYearOptions(now = new Date()): string[] {
  return [...undergraduateYears(now), ...NON_UNDERGRAD_YEARS];
}
