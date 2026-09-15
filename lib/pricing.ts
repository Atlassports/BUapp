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

  const low = Math.max(5, Math.round((base * 0.85) / 1) );
  const high = Math.max(low + 3, Math.round(base * 1.15));
  return { low, high, rationale };
}

/** Platform economics. Posters see the fee before they commit to anything. */
export const PLATFORM_FEE_RATE = 0.1;

export function feeBreakdown(cents: number) {
  const fee = Math.round(cents * PLATFORM_FEE_RATE);
  return { total: cents, fee, payout: cents - fee };
}
