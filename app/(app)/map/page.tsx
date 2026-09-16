import Link from "next/link";
import { CampusMap } from "@/components/CampusMap";
import { MapboxMap } from "@/components/MapboxMap";
import { requireUser } from "@/lib/auth";
import { DEFAULT_FILTERS, listTasks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const user = await requireUser();
  const tasks = listTasks(user, { ...DEFAULT_FILTERS, sort: "nearby" });
  // Real tiles when a token is configured; the drawn campus map otherwise, so
  // the page never depends on a third party being reachable or paid for.
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? null;

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href="/feed" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-[19px] font-bold tracking-tight">Map</h1>
      </header>
      {token ? (
        <MapboxMap token={token} tasks={tasks} home={{ lat: user.home_lat, lng: user.home_lng }} />
      ) : (
        <CampusMap tasks={tasks} home={{ lat: user.home_lat, lng: user.home_lng }} />
      )}
    </>
  );
}
