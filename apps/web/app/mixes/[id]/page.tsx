import { notFound } from "next/navigation";
import { MixBuilder } from "@/components/mix/mix-builder";
import { requireUserPage } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { getMix } from "@/lib/db/mixes-repo";

export const dynamic = "force-dynamic";

export default async function MixPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const mix = await getMix(getSql(), user.id, (await params).id);
  if (!mix) notFound();
  return <MixBuilder key={mix.id} mix={mix} />;
}
