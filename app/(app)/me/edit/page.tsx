import Link from "next/link";
import { ProfileEditor } from "@/components/ProfileEditor";
import { requireUser } from "@/lib/auth";
import { PLACES } from "@/lib/geo";
import type { TransportId } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const user = await requireUser();
  // Store keeps the area label; map it back to the closest matching place.
  const place =
    PLACES.find((p) => p.lat === user.home_lat && p.lng === user.home_lng) ??
    PLACES.find((p) => p.area === user.home_area) ??
    PLACES[0];

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href="/me" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-[19px] font-bold tracking-tight">Edit profile</h1>
      </header>
      <ProfileEditor
        initial={{
          name: user.name,
          bio: user.bio,
          classYear: user.class_year,
          homePlace: place.id,
          transport: (user.transport ? user.transport.split(",") : []) as TransportId[],
          skills: user.skills ? user.skills.split(",").filter(Boolean) : [],
        }}
      />
    </>
  );
}
