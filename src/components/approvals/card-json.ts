import cardTemplate from "../../../integrations/teams/approval-card.json";
import type { AppConfig, ApprovalStep, DomainConfig, MdmRequest, PurchaseRequest } from "@/lib/types";
import { buildKeyFacts, countryName, formatFactValue, teamsSla } from "@/components/mocks/teams-helpers";
import { CARD_MASK_TEXT } from "@/components/mocks/TeamsApprovalCard";
import { formatSgd } from "@/components/common/format";

/** The production Adaptive Card template (integrations/teams/approval-card.json), unbound. */
export const APPROVAL_CARD_TEMPLATE: unknown = cardTemplate;

export const DETAILS_BASE_URL = "https://onerecord.livesgroup.example";

type Scope = Record<string, unknown>;

/** The data object Power Automate would bind into the card for this request and step. Sensitive values are masked first. */
export function cardData(
  request: MdmRequest,
  step: ApprovalStep,
  ctx: { config: Pick<AppConfig, "people" | "sla">; domain: DomainConfig | undefined; prs: PurchaseRequest[]; nowIso: string },
): Scope {
  const requestor = ctx.config.people.find((p) => p.id === request.requestorId);
  const sla = teamsSla(step, ctx.config.sla, ctx.nowIso);
  const facts = buildKeyFacts(request, ctx.domain, { limit: 6, role: step.role }).map((f) => ({
    label: f.label,
    value: f.sensitive ? CARD_MASK_TEXT : formatFactValue(f.value),
  }));
  const ids = new Set(request.blockedPrIds ?? []);
  const blocked = ctx.prs.filter((p) => (ids.has(p.id) || p.blockedByRequestId === request.id) && p.status === "blocked");
  if (blocked.length > 0) {
    const sgd = blocked.reduce((sum, p) => sum + p.sgd, 0);
    facts.push({ label: "Blocked demand", value: `${blocked.length} customer PR${blocked.length === 1 ? "" : "s"} · ${formatSgd(sgd)}` });
  }
  return {
    request: { id: request.id, title: request.title, entity: request.entity, countryName: countryName(request.country) },
    requestor: { name: requestor?.name ?? request.requestorId, email: requestor?.email ?? "" },
    step: { id: step.id, label: step.label, addedBecause: step.addedBecause ?? "" },
    sla: { label: sla.label, overdue: sla.tone === "overdue" },
    facts,
    detailsUrl: `${DETAILS_BASE_URL}/requests/view?id=${encodeURIComponent(request.id)}`,
  };
}

function lookup(scope: Scope, path: string): unknown {
  let cur: unknown = scope;
  for (const part of path.trim().split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Evaluates the small expression subset the template uses: paths, if(cond, 'a', 'b') and `x != ''`. */
function evaluate(expr: string, scope: Scope): unknown {
  const e = expr.trim();
  const ifMatch = /^if\((.+?),\s*'([^']*)',\s*'([^']*)'\)$/.exec(e);
  if (ifMatch) return evaluate(ifMatch[1], scope) ? ifMatch[2] : ifMatch[3];
  const neq = /^(.+?)\s*!=\s*''$/.exec(e);
  if (neq) {
    const v = lookup(scope, neq[1]);
    return v !== undefined && v !== null && v !== "";
  }
  return lookup(scope, e);
}

function bindString(s: string, scope: Scope): unknown {
  const whole = /^\$\{([^}]+)\}$/.exec(s);
  if (whole) {
    const v = evaluate(whole[1], scope);
    return v === undefined ? "" : v;
  }
  return s.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    const v = evaluate(expr, scope);
    return v === undefined || v === null ? "" : String(v);
  });
}

function bindNode(node: unknown, scope: Scope): unknown {
  if (typeof node === "string") return bindString(node, scope);
  if (Array.isArray(node)) {
    const out: unknown[] = [];
    for (const item of node) {
      if (item && typeof item === "object" && !Array.isArray(item) && "$data" in item) {
        const { $data, ...rest } = item as Record<string, unknown>;
        const list = typeof $data === "string" ? bindString($data, scope) : $data;
        for (const row of Array.isArray(list) ? list : []) {
          out.push(bindNode(rest, { ...scope, ...(row as Scope) }));
        }
        continue;
      }
      if (item && typeof item === "object" && !Array.isArray(item) && "$when" in item) {
        const { $when, ...rest } = item as Record<string, unknown>;
        const keep = typeof $when === "string" ? bindString($when, scope) : $when;
        if (!keep || keep === "false") continue;
        out.push(bindNode(rest, scope));
        continue;
      }
      out.push(bindNode(item, scope));
    }
    return out;
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node)) out[k] = bindNode(v, scope);
    return out;
  }
  return node;
}

/** The card JSON exactly as Teams would receive it for this request: template + data, expressions resolved. */
export function bindApprovalCard(data: Scope): unknown {
  return bindNode(APPROVAL_CARD_TEMPLATE, data);
}
