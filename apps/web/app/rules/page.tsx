import { RulesLibrary } from "@/components/rules/rules-library";
import { requireUserPage } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { listRules } from "@/lib/db/rules-repo";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const user = await requireUserPage();
  return <RulesLibrary initialRules={await listRules(getSql(), user.id)} />;
}
