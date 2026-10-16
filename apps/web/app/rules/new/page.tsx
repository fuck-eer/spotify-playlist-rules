import { RuleEditor } from "@/components/rules/rule-editor";
import { requireUserPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewRulePage({
  searchParams,
}: {
  searchParams: Promise<{ mix?: string | string[] }>;
}) {
  await requireUserPage();
  const { mix } = await searchParams;
  return <RuleEditor rule={null} mixId={typeof mix === "string" && mix ? mix : null} />;
}
