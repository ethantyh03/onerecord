import { createHash } from "node:crypto"; // test oracle only; the engine itself is pure JS
import { describe, expect, it } from "vitest";
import { GENESIS_HASH, appendAudit, canonicalJson, sha256Hex, verifyChain } from "../audit";
import type { AuditEvent } from "@/lib/types";

describe("sha256Hex", () => {
  it("matches the NIST test vectors", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("agrees with Node's crypto on multi-block and non-ASCII (UTF-8) input", () => {
    const inputs = [
      "a".repeat(55),
      "a".repeat(56),
      "a".repeat(64),
      "a".repeat(1000),
      "Category = IVD reagent → regulatory review required",
      "Nguyễn Thị Lan · 曼谷 · 🧪 reagent",
      JSON.stringify({ before: { creditLimit: 80000 }, after: { creditLimit: 120000 } }),
    ];
    for (const s of inputs) {
      expect(sha256Hex(s)).toBe(createHash("sha256").update(s, "utf8").digest("hex"));
    }
  });
});

describe("canonicalJson", () => {
  it("sorts keys recursively and drops undefined", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: undefined } })).toBe('{"a":{"d":[3,{"y":2,"z":1}]},"b":1}');
  });
});

function sampleChain(): AuditEvent[] {
  let chain: AuditEvent[] = [];
  chain = appendAudit(chain, { requestId: "REQ-1042", at: "2026-10-20T01:00:00.000Z", actorId: "amy", action: "submitted" });
  chain = appendAudit(chain, {
    requestId: "REQ-1042",
    at: "2026-10-20T03:00:00.000Z",
    actorId: "ploy",
    action: "approved",
    detail: "Licence verified",
  });
  chain = appendAudit(chain, {
    requestId: "REQ-1042",
    at: "2026-10-21T03:00:00.000Z",
    actorId: "priya",
    action: "field_edited",
    before: { uom: "EA" },
    after: { uom: "BOX" },
  });
  return chain;
}

describe("audit chain", () => {
  it("links events from the genesis hash", () => {
    const chain = sampleChain();
    expect(chain.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(chain[0].prevHash).toBe(GENESIS_HASH);
    expect(GENESIS_HASH).toBe("0".repeat(64));
    expect(chain[1].prevHash).toBe(chain[0].hash);
    expect(chain[2].prevHash).toBe(chain[1].hash);
  });

  it("a chain of 3 verifies", () => {
    expect(verifyChain(sampleChain())).toEqual({ ok: true });
    expect(verifyChain([])).toEqual({ ok: true });
  });

  it("mutating event 1's detail ⇒ { ok: false, brokenAt: 1 }", () => {
    const chain = sampleChain();
    chain[1] = { ...chain[1], detail: "Licence not checked" };
    expect(verifyChain(chain)).toEqual({ ok: false, brokenAt: 1 });
  });

  it("detects a deleted event and a recomputed-but-relinked forgery", () => {
    const chain = sampleChain();
    expect(verifyChain([chain[0], chain[2]])).toEqual({ ok: false, brokenAt: 1 });
    const forged = sampleChain();
    const rest: Omit<AuditEvent, "hash"> & { hash?: string } = { ...forged[1], detail: "Forged" };
    delete rest.hash;
    forged[1] = { ...rest, hash: sha256Hex(rest.prevHash + canonicalJson(rest)) };
    expect(verifyChain(forged)).toEqual({ ok: false, brokenAt: 2 });
  });

  it("survives a JSON round-trip (localStorage persistence)", () => {
    const chain = JSON.parse(JSON.stringify(sampleChain())) as AuditEvent[];
    expect(verifyChain(chain).ok).toBe(true);
  });

  it("does not mutate the input chain", () => {
    const chain = sampleChain();
    const copy = JSON.stringify(chain);
    appendAudit(chain, { requestId: "CONFIG", at: "2026-10-22T00:00:00.000Z", actorId: "priya", action: "config_changed" });
    expect(JSON.stringify(chain)).toBe(copy);
  });
});
