import { redirect } from "next/navigation";
import { BottomNav } from "@/components/BottomNav";
import { currentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/queries";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/welcome");

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))]">
      {children}
      <BottomNav unread={unreadCount(user.id)} />
    </div>
  );
}
