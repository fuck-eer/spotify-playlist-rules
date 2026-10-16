import { Button } from "@/components/ui/button";
import { requireUserPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Placeholder; ticket 08 replaces this with Home. */
export default async function MixesPage() {
  await requireUserPage();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg text-tx">
      <h1 className="text-2xl font-bold">Mixes</h1>
      <form action="/api/auth/logout" method="post">
        <Button type="submit" variant="secondary">
          Sign out
        </Button>
      </form>
    </main>
  );
}
