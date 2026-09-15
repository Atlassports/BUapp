import { Composer } from "@/components/Composer";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PostPage() {
  const user = await requireUser();
  return (
    <>
      <header className="px-4 pb-4 pt-5">
        <h1 className="text-[26px] font-bold tracking-tight">Post a task</h1>
        <p className="muted mt-1 text-[14px] leading-relaxed">
          Describe it in one line. Sidekick fills in the rest and suggests a fair campus price.
        </p>
      </header>
      <Composer home={{ lat: user.home_lat, lng: user.home_lng }} />
    </>
  );
}
