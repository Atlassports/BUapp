import { categoryOf, type CategoryId, type TransportId } from "./taxonomy";

/**
 * Campus pricing intelligence, v0. It's a transparent heuristic today; once
 * there's real completion data the same interface can be backed by observed
 * clearing prices per category and distance band.
 */
export function suggestPrice(input: {
  category: CategoryId;
  estMinutes: number;
  distanceMi: number;
  transportRequired: TransportId | null;
  urgentHours: number | null;
}): { low: number; high: number; rationale: string[] } {
  const cat = categoryOf(input.category);
  const minutes = Math.max(10, input.estMinutes || cat.typicalMinutes);
  const rationale: string[] = [];

  let base = (minutes / 60) * cat.typicalHourly;
  rationale.push(`${minutes} min at the ~$${cat.typicalHourly}/hr ${cat.label.toLowerCase()} rate`);

  if (input.distanceMi > 1) {
    const travel = Math.min(15, (input.distanceMi - 1) * 3);
    base += travel;
    rationale.push(`+$${travel.toFixed(0)} for ${input.distanceMi.toFixed(1)} mi of travel`);
  }

  if (input.transportRequired === "car" || input.transportRequired === "moto") {
    base += 8;
    rationale.push("+$8 because it needs a vehicle");
  }

  if (input.urgentHours !== null && input.urgentHours <= 2) {
    base *= 1.2;
    rationale.push("+20% for a same-hour deadline");
  }

  const low = Math.max(5, Math.round(base * 0.85));
  const high = Math.max(low + 3, Math.round(base * 1.15));
  return { low, high, rationale };
}

/* ------------------------------------------------------------------ */
/* Platform economics                                                  */
/* ------------------------------------------------------------------ */

/**
 * Small tasks carry a reduced rate. A $12 laundry run is exactly the kind of
 * high-frequency post that builds liquidity, and it's also where a full-rate
 * fee bites hardest relative to what the work is worth. Cheap errands are the
 * flywheel, so they're priced to keep spinning.
 *
 * The rate is MARGINAL, like a tax bracket: 5% applies to the first $20 of any
 * task and 10% only to the part above it. A flat "5% under $20, 10% at or
 * above" would mean a $20 task pays the tasker $18.00 while a $19.99 task pays
 * $18.99 — the rounder, more generous price quietly pays the worker less, and
 * $20 is the most common price point on the platform. Marginal rates make the
 * payout rise smoothly with the price, always.
 */
export const STANDARD_FEE_RATE = 0.1;
export const SMALL_TASK_FEE_RATE = 0.05;
export const SMALL_TASK_CEILING_CENTS = 2000;

export function feeBreakdown(cents: number) {
  const discounted = Math.min(cents, SMALL_TASK_CEILING_CENTS);
  const remainder = Math.max(0, cents - SMALL_TASK_CEILING_CENTS);
  const fee = Math.round(discounted * SMALL_TASK_FEE_RATE + remainder * STANDARD_FEE_RATE);
  return { total: cents, fee, payout: cents - fee, rate: cents > 0 ? fee / cents : 0 };
}

/** The blended rate as UI copy, e.g. "5%" or "8%", never a hardcoded number. */
export function feePercentLabel(cents: number): string {
  return `${Math.round(feeBreakdown(cents).rate * 100)}%`;
}
