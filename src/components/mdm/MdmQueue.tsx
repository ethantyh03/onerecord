"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
  SectionTitle,
} from "@/components/common";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { approvedAt } from "./mdm-helpers";
import { EntityCell } from "./Panel";

/** Queue of requests waiting for the MDM final check, plus the records most recently created in SAP B1. */
export function MdmQueue({ mine = true }: { mine?: boolean }) {
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
    <div className="space-y-10">
      {/* On the open page, not boxed: a ruled section title (title, plain count, hairline) over a dense table. */}
      <section aria-labelledby="mdm-queue-title">
        <SectionTitle
          id="mdm-queue-title"
          title={mine ? "Waiting for your final check" : "Waiting for MDM’s final check"}
          count={queue.length}
          description={
            queue.length
              ? queueSgd > 0
                ? `Every business approval is done. ${formatSgd(queueSgd)} of customer orders are waiting on these records.`
                : "Every business approval is done."
              : undefined
          }
        />
        {queue.length === 0 ? (
          <EmptyState
            size="sm"
            className="px-0"
            title="Nothing waiting for a final check"
            description="Requests appear here as soon as their last business approver signs off."
          />
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">Request</TableHead>
                <TableHead className="hidden 2xl:table-cell">Type</TableHead>
                <TableHead>Entity / country</TableHead>
                <TableHead>Approved at</TableHead>
                <TableHead className="w-28 text-right whitespace-normal">Business days waiting</TableHead>
                <TableHead className="w-32 text-right whitespace-normal">Customer orders waiting</TableHead>
                <TableHead className="w-24 pr-0" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map(({ r, domain, configured, at, waiting, sgd, prCount }) => (
                <TableRow
                  key={r.id}
                  data-testid={`mdm-queue-${r.id}`}
                  className="group/row cursor-pointer"
                  onClick={() => router.push(`/mdm?id=${r.id}`)}
                >
                  <TableCell className="py-2.5 pl-0">
                    <div className="flex flex-col gap-0.5">
                      <SapCode code={r.id} variant="plain" className="text-muted-foreground" />
                      <span className="max-w-[30ch] truncate text-sm font-medium text-foreground 2xl:max-w-[38ch]">{r.title}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-[0.8125rem] text-secondary-foreground 2xl:table-cell">{domain?.label ?? r.domainId}</TableCell>
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
                        <span className="text-xs text-subtle">
                          {prCount} order{prCount === 1 ? "" : "s"}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-subtle">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    {/* The row is the action: "Review" is quiet text that brightens with the row, not a boxed button. */}
                    <Link
                      href={`/mdm?id=${r.id}`}
                      data-testid={`mdm-open-${r.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 rounded-sm text-[0.8125rem] font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none group-hover/row:text-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      Review
                      <ArrowRight aria-hidden className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section aria-labelledby="mdm-created-title">
        <SectionTitle
          id="mdm-created-title"
          title="Recently created in SAP B1"
          description="Records imported through the Data Transfer Workbench after the MDM final check."
        />
        {recent.length === 0 ? (
          <EmptyState size="sm" className="px-0" title="No records created yet" description="Mark a request created in SAP B1 and it lands here." />
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-0">SAP code</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Requested by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="pr-0 text-right">Orders released</TableHead>
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
                  <TableCell className="py-2.5 pl-0">
                    <SapCode code={r.sapCode} variant="plain" className="font-medium" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col leading-tight">
                      <span className="max-w-[40ch] truncate text-sm text-foreground">{r.title}</span>
                      <span className="text-xs text-muted-foreground">
                        <span className="mono-id">{r.id}</span> · {domain?.label ?? r.domainId}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <PersonChip personId={r.requestorId} />
                  </TableCell>
                  <TableCell className="num text-[0.8125rem] text-secondary-foreground">
                    {r.sapCreatedAt ? formatSgtDateTime(r.sapCreatedAt) : "—"}
                  </TableCell>
                  <TableCell className="num pr-0 text-right text-sm">
                    {released > 0 ? <span className="font-semibold text-ok-ink">{formatSgd(released)}</span> : <span className="text-subtle">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
