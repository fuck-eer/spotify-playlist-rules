import { redirect } from "next/navigation";
import { SignIn } from "@/components/sign-in";
import { optionalUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await optionalUser()) redirect("/mixes");
  const { error } = await searchParams;
  return <SignIn error={error === "denied" || error === "state" ? error : null} />;
}
