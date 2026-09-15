export function money(cents: number): string {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

export function priceLabel(t: {
  price_type: string;
  price_min: number;
  price_max: number;
}): string {
  if (t.price_type === "open") return "Open";
  if (t.price_type === "range") return `${money(t.price_min)}–${money(t.price_max)}`;
  return money(t.price_min);
}

export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function dueLabel(due: number | null): string {
  if (due === null) return "No deadline";
  const diff = due - Date.now();
  if (diff < 0) return "Overdue";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `Due in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Due in ${hours}h`;
  const d = new Date(due);
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${d.toLocaleDateString("en-US", { weekday: "long" })} ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function isUrgent(due: number | null): boolean {
  return due !== null && due - Date.now() < 1000 * 60 * 60 * 3 && due > Date.now();
}

export function clockTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
