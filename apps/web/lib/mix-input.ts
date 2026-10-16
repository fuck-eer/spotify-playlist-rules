import { z } from "zod";
import { HttpError } from "./http";

const Source = z.discriminatedUnion("type", [
  z.object({ type: z.literal("liked"), id: z.null().optional() }),
  z.object({ type: z.literal("playlist"), id: z.string().min(1) }),
]);
const Name = z.string().trim().min(1).max(80);

export const CreateMixBody = z.object({ name: Name, source: Source });
export const PatchMixBody = z
  .object({
    name: Name.optional(),
    source: Source.optional(),
    keepSourceOrder: z.boolean().optional(),
  })
  .strict();

export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "invalid_body", "That request wasn't valid.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, "invalid_body", "That request wasn't valid.");
  return parsed.data;
}

export function normalizeSource(s: z.infer<typeof Source>): {
  type: "playlist" | "liked";
  id: string | null;
} {
  return s.type === "liked" ? { type: "liked", id: null } : { type: "playlist", id: s.id };
}
