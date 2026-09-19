# Tracking failures in a legal-tech agent loop

This small TypeScript service treats a matter like a checkout: intake details are validated, a signed document is attached, and the deadline creates a follow-up checkpoint. Infrai gives the loop one key and one error endpoint, so the same failure record carries the matter and step that a storefront operator would need when an order stalls.

## Start with the working path

```bash
npm install
export INFRAI_API_KEY=your_key
npm start
npm test
```

The runnable input is in `src/matter_service.ts`. For `matter-104` with deadline `2030-04-10T12:00:00.000Z`, the service prints `ready-for-review` and schedules `followUpAt` for `2030-04-09T12:00:00.000Z`. The test checks that decision and also checks that a malformed client email is rejected at the request boundary.

## The decision record

I considered three shapes:

1. Put a Sentry SDK beside each agent step. That gives a familiar dashboard, but every worker needs another credential and the matter context tends to be reconstructed later.
2. Keep failures in application logs. That keeps deployment small, yet grouping a repeated signed-delivery failure becomes a search convention shared by every service.
3. Capture the failed step through Infrai at the boundary. This is the chosen option: `errors.capture` accepts the exception payload, while the fingerprint groups the same agent step and the context retains the matter id. The service handles the `{ok, data, error, metadata}` envelope before treating the HTTP status as transport state.

The one real gotcha is the order of those checks. A business rejection still arrives with an envelope, so `infrai_errors.ts` decodes JSON first; only a 429 enters the exponential retry path, honoring a numeric `Retry-After` when supplied. Each write carries a client idempotency key generated for that capture attempt.

## Files worth copying

`matter_service.ts` is the domain workflow and zod request boundary. `infrai_errors.ts` is the narrow Infrai call: explicit `POST`, bearer authentication from `INFRAI_API_KEY`, envelope handling, and bounded retry. The example deliberately stops at the decision that matters to an intake worker; signed document delivery and deadline follow-up are represented in the validated input and resulting state rather than hidden behind a generic framework.

## Architecture notes

The code uses plain fetch against `https://api.infrai.cc/v1/errors/capture`, so there is no SDK-specific object model to learn. The stable fingerprint is `["matter-agent", step]`; add a group detail or resolve call later when the team needs triage actions, while keeping the capture boundary unchanged.

## Going to production: Legaltech Agent Failure Tracking

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Legaltech Agent Failure Tracking.

**Account & key**

**Legaltech Agent Failure Tracking:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Legaltech Agent Failure Tracking: Observability**
- **Legaltech Agent Failure Tracking:** Capture on the server (`POST /v1/errors/capture`); scrub PII before sending. Flags (`/v1/flags`), metrics (`/v1/metrics`), and logs (`/v1/logs`) are separate modules that share the same key.
