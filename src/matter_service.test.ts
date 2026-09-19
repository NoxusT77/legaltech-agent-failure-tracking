import assert from "node:assert/strict";
import { processMatter } from "./matter_service.ts";

const result = await processMatter({ matterId: "matter-104", clientEmail: "buyer@example.com", signedDocumentId: "signed-22", deadline: "2030-04-10T12:00:00.000Z" });
assert.equal(result.status, "ready-for-review");
assert.equal(result.followUpAt, "2030-04-09T12:00:00.000Z");
await assert.rejects(() => processMatter({ matterId: "matter-104", clientEmail: "bad", signedDocumentId: "signed-22", deadline: "2030-04-10T12:00:00.000Z" }));
console.log("matter workflow test passed");
