import { MixBuilder } from "@/components/mix/mix-builder";
import { requireUserPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function NewMixPage() {
  await requireUserPage();
  return <MixBuilder mix={null} />;
}
