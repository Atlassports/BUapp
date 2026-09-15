import { redirect } from "next/navigation";
import { WelcomeFlow } from "@/components/WelcomeFlow";
import { ALLOWED_DOMAIN, currentUser } from "@/lib/auth";

export default async function WelcomePage() {
  if (await currentUser()) redirect("/feed");
  return <WelcomeFlow domain={ALLOWED_DOMAIN} />;
}
