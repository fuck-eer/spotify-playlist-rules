import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { MixList } from "@/components/mix/mix-list";
import { RulesIconLink } from "@/components/mix/rules-icon-link";
import { Button } from "@/components/ui/button";
import { requireUserPage } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { listMixes } from "@/lib/db/mixes-repo";

export const dynamic = "force-dynamic";

export default async function MixesPage() {
  const user = await requireUserPage();
  const mixes = await listMixes(getSql(), user.id);
  return (
    <main className="relative mx-auto flex min-h-screen max-w-xl flex-col bg-bg text-tx">
      <div className="h-10 flex-none" />
      <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-1.5">
        <Logo className="[&>span:last-child]:text-lg" />
        <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">Mixes</h1>
        <RulesIconLink />
        <AccountMenu />
      </div>
      <div className="flex-1 px-4 pb-32">
        <MixList mixes={mixes} />
      </div>
      <Button
        asChild
        className="fixed bottom-6 right-4 rounded-full bg-tx px-5 font-bold text-black"
      >
        <Link href="/mixes/new">New mix</Link>
      </Button>
    </main>
  );
}
