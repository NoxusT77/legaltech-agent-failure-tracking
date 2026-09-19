import { z } from "zod";
import { captureMatterFailure } from "./infrai_errors.ts";

export const matterRequest = z.object({
  matterId: z.string().min(1),
  clientEmail: z.string().email(),
  signedDocumentId: z.string().min(1),
  deadline: z.string().datetime()
});
export type MatterRequest = z.infer<typeof matterRequest>;

export type MatterResult = { matterId: string; status: "ready-for-review"; followUpAt: string };

export async function processMatter(raw: unknown): Promise<MatterResult> {
  const input = matterRequest.parse(raw);
  try {
    const followUpAt = new Date(new Date(input.deadline).getTime() - 24 * 60 * 60 * 1000).toISOString();
    return { matterId: input.matterId, status: "ready-for-review", followUpAt };
  } catch (error) {
    await captureMatterFailure({ matterId: input.matterId, step: "matter-follow-up", error });
    throw error;
  }
}

if (process.argv[1]?.endsWith("matter_service.ts")) {
  const example = { matterId: "matter-104", clientEmail: "buyer@example.com", signedDocumentId: "signed-22", deadline: "2030-04-10T12:00:00.000Z" };
  processMatter(example).then((result) => console.log(JSON.stringify(result))).catch((error) => { console.error(error); process.exitCode = 1; });
}
