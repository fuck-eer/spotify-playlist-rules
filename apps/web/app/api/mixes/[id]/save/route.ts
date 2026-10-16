import type { NextRequest } from "next/server";
import { startRunResponse } from "@/lib/run-route";
import { performSave } from "@/lib/save";

/** Save to Spotify: writes the Mix's Target playlist (ADR-0013, ADR-0015). Progress is polled (A5). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return startRunResponse(req, params, "save", performSave);
}
