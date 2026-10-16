import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUserPage } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={2 + (i % 3) * 6}
          y={2 + Math.floor(i / 3) * 6}
          width="4"
          height="4"
          rx="1"
        />
      ))}
    </svg>
  );
}

/** Placeholder Home; ticket 09 fills in the Mix list. */
export default async function MixesPage() {
  await requireUserPage();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col bg-bg px-5 text-tx">
      <header className="flex items-center justify-between py-4">
        <h1 className="text-2xl font-bold">Mixes</h1>
        <Link href="/rules" aria-label="Rules" className="rounded-full p-2 hover:bg-s2">
          <GridIcon />
        </Link>
      </header>
      <div className="flex flex-1 items-center justify-center">
        <form action="/api/auth/logout" method="post">
          <Button type="submit" variant="secondary">
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
