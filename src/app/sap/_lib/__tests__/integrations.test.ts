import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDtwFiles } from "@/lib/engine/dtw";
import type { DomainConfig, MdmRequest } from "@/lib/types";
import { SAP_FIELD_LIMITS } from "../dtw-sim";

const ROOT = path.resolve(process.cwd(), "integrations");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

type Json = Record<string, unknown>;

function walk(node: unknown, visit: (n: Json) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node as Json);
    Object.values(node as Json).forEach((v) => walk(v, visit));
  }
}

describe("Teams Adaptive Card", () => {
  const card = JSON.parse(read("teams/approval-card.json"));
  const data = JSON.parse(read("teams/approval-card.data.json"));

  it("is an Adaptive Card 1.5 with a templated FactSet and a comment input", () => {
    expect(card.type).toBe("AdaptiveCard");
    expect(card.version).toBe("1.5");
    const types: Json[] = [];
    walk(card, (n) => typeof n.type === "string" && types.push(n));
    const factSet = types.find((n) => n.type === "FactSet") as { facts: Json[] } | undefined;
    expect(factSet?.facts[0]?.$data).toBe("${facts}");
    expect(types.some((n) => n.type === "Input.Text" && n.id === "comment")).toBe(true);
  });

  it("has Action.Execute approve and reject, plus ask and a details link", () => {
    const actions: Json[] = [];
    walk(card, (n) => typeof n.type === "string" && String(n.type).startsWith("Action.") && actions.push(n));
    const verbs = actions.filter((a) => a.type === "Action.Execute").map((a) => a.verb);
    expect(verbs).toEqual(expect.arrayContaining(["approve", "reject", "ask"]));
    expect(actions.some((a) => a.type === "Action.OpenUrl" && a.url === "${detailsUrl}")).toBe(true);
  });

  it("binds only paths that exist in the sample data", () => {
    const text = read("teams/approval-card.json");
    const paths = [...text.matchAll(/\$\{([A-Za-z_][\w.]*)\}/g)].map((m) => m[1]);
    expect(paths.length).toBeGreaterThan(5);
    const factFields = new Set(["label", "value"]); // resolved inside the $data repeat
    for (const p of paths) {
      if (factFields.has(p)) continue;
      const value = p.split(".").reduce<unknown>((o, k) => (o as Json | undefined)?.[k], data);
      expect(value, `binding \${${p}}`).not.toBeUndefined();
    }
  });
});

describe("DTW templates", () => {
  const dir = path.join(ROOT, "sap/dtw-templates");
  const names = readdirSync(dir).filter((f) => f.endsWith(".csv"));

  it("ships the five templates, each with exactly two equal-length CRLF header rows", () => {
    expect(names.sort()).toEqual(["BPAddresses.csv", "BPBankAccounts.csv", "oBusinessPartners.csv", "oItems.csv", "oProfitCenter.csv"]);
    for (const n of names) {
      const raw = readFileSync(path.join(dir, n), "utf8");
      expect(raw.endsWith("\r\n"), n).toBe(true);
      const rows = raw.split("\r\n").filter(Boolean).map((l) => l.split(","));
      expect(rows, n).toHaveLength(2);
      expect(rows[0].length, n).toBe(rows[1].length);
    }
  });

  const dom = (id: string, sapObject: string, codePrefix: string): DomainConfig => ({
    id, label: id, description: "", icon: "box", sapObject, codePrefix, fields: [], stages: [], dupCheck: false, enabled: true,
  });
  const req = (domainId: string, data: MdmRequest["data"]): MdmRequest => ({
    id: "REQ-2001", domainId, title: "t", requestorId: "amy", entity: "SPD", country: "SG", createdAt: "2026-10-20T02:00:00.000Z",
    status: "mdm_review", data, configVersion: 1, steps: [], blockedPrIds: [],
  });

  it("covers every column the engine generates, with the same DB column names", () => {
    const generated = [
      ...buildDtwFiles(req("vendor", { vendorName: "V", bankAccountNo: "514012345678", swift: "MBBEMYKL", street: "1 Road", country: "MY" }), dom("vendor", "oBusinessPartners", "V"), "V-MY-00045"),
      ...buildDtwFiles(req("item", { itemName: "Kit", productGroup: "A", category: "IVD reagent", regLicenceNo: "MDA-1" }), dom("item", "oItems", "I"), "I-A-000813"),
      ...buildDtwFiles(req("costcentre", { centreName: "SPD Field Service SG", dimension: "3" }), dom("costcentre", "oProfitCenter", "CC"), "SG-0031"),
    ];
    for (const f of generated) {
      if (!names.includes(f.fileName)) continue;
      const [top, db] = read(`sap/dtw-templates/${f.fileName}`).split("\r\n").map((l) => l.split(","));
      f.headers.forEach((h, i) => {
        const at = top.indexOf(h);
        expect(at, `${f.fileName} is missing ${h}`).toBeGreaterThanOrEqual(0);
        expect(db[at], `${f.fileName} ${h}`).toBe(f.dbHeaders[i]);
      });
    }
  });
});

describe("Service Layer samples", () => {
  const samples = JSON.parse(read("sap/service-layer-samples.json")) as {
    baseUrl: string;
    requests: { name: string; method: string; path: string; body?: unknown }[];
  };

  it("logs in first, logs out last, and only uses documented methods", () => {
    expect(samples.baseUrl).toBe("https://<b1-server>:50000/b1s/v2");
    expect(samples.requests[0].path).toBe("/Login");
    expect(samples.requests.at(-1)?.path).toBe("/Logout");
    for (const r of samples.requests) {
      expect(["POST", "PATCH"]).toContain(r.method);
      expect(r.path.startsWith("/")).toBe(true);
    }
  });

  it("keeps every key field inside SAP's length limits", () => {
    for (const r of samples.requests) {
      if (!r.body || typeof r.body !== "object") continue;
      walk(r.body, (n) => {
        for (const [k, v] of Object.entries(n)) {
          const limit = SAP_FIELD_LIMITS[k];
          if (limit && typeof v === "string") expect(v.length, `${r.name} ${k}`).toBeLessThanOrEqual(limit);
        }
      });
    }
  });
});
