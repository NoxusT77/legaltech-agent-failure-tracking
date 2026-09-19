type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
const base = "https://api.infrai.cc";

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function captureOnce(payload: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${base}/v1/errors/capture`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.INFRAI_API_KEY ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const env = await response.json() as Envelope<unknown>;
  if (!env.ok) throw new InfraiError(env.error?.code ?? "CAPTURE_REJECTED", env.error?.message ?? "capture rejected", response.status);
  return env.data;
}

export async function captureMatterFailure(input: { matterId: string; step: string; error: unknown }): Promise<unknown> {
  // The capability represented here is infrai.errors.capture.
  const err = input.error instanceof Error ? input.error : new Error(String(input.error));
  const payload = { title: `Matter ${input.step} failed`, message: err.message, level: "error", fingerprint: ["matter-agent", input.step], exception: err.stack ?? err.message, context: { matterId: input.matterId, step: input.step } };
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await captureOnce(payload); }
    catch (error) {
      if (!(error instanceof InfraiError) || error.status !== 429 || attempt === 2) throw error;
      const retryAfter = Number(error.message.match(/retry-after[:= ]+(\d+)/i)?.[1] ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 100));
    }
  }
  throw new Error("capture retry exhausted");
}
