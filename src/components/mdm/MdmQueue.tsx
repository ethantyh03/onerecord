"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useSandbox } from "@/lib/store";
import { buById, domainById, selectMdmQueue, selectPrsForRequest, useNow } from "@/lib/selectors";
import { businessDaysBetween } from "@/lib/engine/sla";
import {
  EmptyState,
  formatDays,
  formatSgd,
  formatSgtDateTime,
  PersonChip,
  SapCode,
} from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { approvedAt } from "./mdm-helpers";
import { EntityCell, Panel } from "./Panel";

/** Queue of requests waiting for the MDM final check, plus the records most recently created in SAP B1. */
export function MdmQueue() {
  const router = useRouter();
  const requests = useSandbox((s) => s.requests);
  const prs = useSandbox((s) => s.prs);
  const config = useSandbox((s) => s.config);
  const now = useNow();

  const queue = useMemo(() => {
    return selectMdmQueue({ requests }).map((r) => {
      const linked = selectPrsForRequest({ prs, requests }, r.id).filter((p) => p.status === "blocked");
      const at = approvedAt(r);
      return {
        r,
        domain: domainById({ config }, r.domainId),
        configured: !!buById({ config }, r.entity),
        at,
        waiting: at ? businessDaysBetween(at, now) : 0,
        sgd: linked.reduce((a, p) => a + p.sgd, 0),
        prCount: linked.length,
      };
    });
  }, [requests, prs, config, now]);

  const recent = useMemo(() => {
    return requests
      .filter((r) => r.status === "created" && r.sapCode)
      .sort((a, b) => Date.parse(b.sapCreatedAt ?? b.createdAt) - Date.parse(a.sapCreatedAt ?? a.createdAt))
      .slice(0, 8)
      .map((r) => ({
        r,
        domain: domainById({ config }, r.domainId),
        released: selectPrsForRequest({ prs, requests }, r.id).reduce((a, p) => a + p.sgd, 0),
      }));
  }, [requests, prs, config]);

  const queueSgd = queue.reduce((a, q) => a + q.sgd, 0);

  return (
    <div className="space-y-6">
      <Panel
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck aria-hidden className="size-4 text-primary" />
            Waiting for your final check
            <span className="num rounded-full bg-primary-soft px-2 py-px text-xs font-semibold text-accent-foreground">
              {queue.length}
            </span>
          </span>
        }
        description={
          queue.length
            ? queueSgd > 0
              ? `Every business approval is done. ${formatSgd(queueSgd)} of customer orders are waiting on these records.`
              : "Every business approval is done."
            : undefined
        }
        bodyClassName="px-0 py-0"
      >
        {queue.length === 0 ? (
          <EmptyState
            size="sm"
            icon={CheckCircle2}
            title="Nothing waiting for a final check"
            description="Requests appear here as soon as their last business approver signs off."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-muted-foreground">Request</TableHead>
                <TableHead className="text-muted-foreground">Type</TableHead>
                <TableHead className="text-muted-foreground">Entity / country</TableHead>
                <TableHead className="text-muted-foreground">Approved at</TableHead>
                <TableHead className="text-right text-muted-foreground">Business days waiting</TableHead>
                <TableHead className="text-right text-muted-foreground">Customer orders waiting</TableHead>
                <TableHead className="pr-5" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map(({ r, domain, configured, at, waiting, sgd, prCount }) => (
                <TableRow
                  key={r.id}
                  data-testid={`mdm-queue-${r.id}`}
                  className="cursor-pointer"
                  onClick={() => router.push(`/mdm?id=${r.id}`)}
                >
                  <TableCell className="py-3 pl-5">
                    <div className="flex flex-col gap-0.5">
                      <SapCode code={r.id} variant="plain" className="text-xs text-muted-foreground" />
                      <span className="max-w-[34ch] truncate text-sm font-medium text-foreground">{r.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[0.8125rem] text-secondary-foreground">{domain?.label ?? r.domainId}</TableCell>
                  <TableCell>
                    <EntityCell entity={r.entity} country={r.country} configured={configured} />
                  </TableCell>
                  <TableCell className="num text-[0.8125rem] text-secondary-foreground">
                    {at ? formatSgtDateTime(at) : "—"}
                  </TableCell>
                  <TableCell className="num text-right text-sm">
                    <span className={cn(waiting > 1 ? "font-semibold text-warn-ink" : "text-foreground")}>
                      {formatDays(waiting)}
                    </span>
                  </TableCell>
                  <TableCell className="num text-right">
                    {sgd > 0 ? (
                      <span className="flex flex-col items-end leading-tight">
                        <span className="text-sm font-semibold text-stuck">{formatSgd(sgd)}</span>
                        <span className="text-xs text-muted-foreground">
                          {prCount} order{prCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    <Link
                      href={`/mdm?id=${r.id}`}
                      data-testid={`mdm-open-${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Review
                      <ArrowRight aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        title="Recently created in SAP B1"
        description="Records imported through the Data Transfer Workbench after the MDM final check."
        bodyClassName="px-0 py-0"
      >
        {recent.length === 0 ? (
          <EmptyState size="sm" title="No records created yet" description="Mark a request created in SAP B1 and it lands here." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-muted-foreground">SAP code</TableHead>
                <TableHead className="text-muted-foreground">Record</TableHead>
                <TableHead className="text-muted-foreground">Requested by</TableHead>
                <TableHead className="text-muted-foreground">Created</TableHead>
                <TableHead className="pr-5 text-right text-muted-foreground">Orders released</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.map(({ r, domain, released }) => (
                <TableRow
                  key={r.id}
                  data-testid={`mdm-created-${r.id}`}
                  className="cursor-pointer"
                  onClick={() => router.push(`/mdm?id=${r.id}`)}
                >
                  <TableCell className="py-2.5 pl-5">
                    <SapCode code={r.sapCode} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col leading-tight">
                      <span className="max-w-[40ch] truncate text-sm text-foreground">{r.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {r.id} · {domain?.label ?? r.domainId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PersonChip personId={r.requestorId} />
                  </TableCell>
                  <TableCell className="num text-[0.8125rem] text-secondary-foreground">
                    {r.sapCreatedAt ? formatSgtDateTime(r.sapCreatedAt) : "—"}
                  </TableCell>
                  <TableCell className="num pr-5 text-right text-sm">
                    {released > 0 ? <span className="font-semibold text-ok-ink">{formatSgd(released)}</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
