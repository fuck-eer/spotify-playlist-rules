import { notFound } from "next/navigation";
import { RuleEditor } from "@/components/rules/rule-editor";
import { requireUserPage } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { getRule } from "@/lib/db/rules-repo";

export const dynamic = "force-dynamic";

export default async function EditRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mix?: string | string[] }>;
}) {
  const user = await requireUserPage();
  const rule = await getRule(getSql(), user.id, (await params).id);
  if (!rule) notFound();
  const { mix } = await searchParams;
  return (
    <RuleEditor
      rule={{ id: rule.id, kind: rule.kind, n: rule.n }}
      mixId={typeof mix === "string" && mix ? mix : null}
    />
  );
}
