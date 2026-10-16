import { notFound } from "next/navigation";
import { MixBuilder } from "@/components/mix/mix-builder";
import { requireUserPage } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { listMixRules } from "@/lib/db/mix-rules-repo";
import { getMix } from "@/lib/db/mixes-repo";
import { getPlayerState } from "@/lib/db/users-repo";
import { hasPlaybackScopes } from "@rulemix/spotify";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function MixPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ addRule?: string | string[] }>;
}) {
  const user = await requireUserPage();
  const sql = getSql();
  const mix = await getMix(sql, user.id, (await params).id);
  if (!mix) notFound();
  const rules = await listMixRules(sql, user.id, mix.id);
  const player = await getPlayerState(sql, user.id);
  const { addRule } = await searchParams;
  return (
    <MixBuilder
      key={mix.id}
      mix={mix}
      rules={rules}
      maxRules={env().MAX_RULES_PER_MIX}
      canAutoPlay={hasPlaybackScopes(player?.scopes ?? "")}
      addRuleId={typeof addRule === "string" && addRule ? addRule : null}
    />
  );
}
