"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { MaskedValue } from "@/components/common";
import { formatSgtDate, formatSgtDateTime } from "@/components/common/format";
import { useSandbox } from "@/lib/store";
import type { SapRecord } from "@/lib/types";
import { PRODUCT_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isSensitiveColumn } from "../_lib/dtw-sim";
import {
  cardTypeLabel,
  childFields,
  newestFirst,
  objectKind,
  pick,
  resolveRecordFields,
  yesNo,
  type SapObjectKind,
} from "../_lib/sap-fields";
import { LinkArrow, SapButton, SapField, SapFieldGrid, SapMatrix, SapTabPanel, SapTabs } from "./sap-ui";

type Filter = "all" | SapObjectKind;

export function MasterDataView({
  selectedCode,
  onSelect,
}: {
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
}) {
  const sapRecords = useSandbox((s) => s.sapRecords);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const records = useMemo(() => newestFirst(sapRecords), [sapRecords]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter(
      (r) =>
        (filter === "all" || objectKind(r.object) === filter) &&
        (!q || `${r.code} ${r.name} ${r.requestId ?? ""}`.toLowerCase().includes(q)),
    );
  }, [records, query, filter]);
  const selected = records.find((r) => r.code === selectedCode);

  return (
    <div className="grid min-h-[480px] lg:grid-cols-[minmax(280px,340px)_1fr]">
      {/* Lookup list ("Choose from list") */}
      <aside className="flex min-w-0 flex-col border-b border-[#c3ced9] bg-[#e9eef3] lg:border-r lg:border-b-0" aria-label="Master data lookup">
        <div className="space-y-2 border-b border-[#c3ced9] p-3">
          <label className="flex items-center gap-2 text-[11.5px] text-[#2c3e50]">
            <span className="w-10 shrink-0">Find</span>
            <span className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-1.5 size-3 -translate-y-1/2 text-[#6b7d8f]" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Code, name or request"
                className="h-[22px] w-full border border-[#a9b7c5] bg-white pr-1.5 pl-6 text-[11.5px] outline-none focus:border-[#2f6db5]"
              />
            </span>
          </label>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Object type">
            {(["all", "bp", "item", "profit"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "h-[20px] rounded-[3px] border px-2 text-[11px]",
                  filter === f ? "border-[#c38d00] bg-[#ffe9a8] font-semibold text-[#2b2000]" : "border-[#a9b7c5] bg-white text-[#2c3e50] hover:bg-[#f6f8fa]",
                )}
              >
                {f === "all" ? "All" : f === "bp" ? "Business Partners" : f === "item" ? "Items" : "Profit Centers"}
              </button>
            ))}
          </div>
        </div>
        <div className="max-h-[520px] min-h-0 flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11.5px] text-[#5b6f83]">
              {records.length === 0 ? "No records imported yet. Use the Data Transfer Workbench tab." : "No records match."}
            </p>
          ) : (
            <table className="w-full border-collapse text-[11.5px]">
              <thead className="sticky top-0">
                <tr className="bg-gradient-to-b from-[#e9eef3] to-[#d3dce5] text-left text-[#1c2a39]">
                  <th scope="col" className="border-b border-[#b3c1ce] px-2 py-1 font-semibold">Code</th>
                  <th scope="col" className="border-b border-[#b3c1ce] px-2 py-1 font-semibold">Name</th>
                  <th scope="col" className="border-b border-[#b3c1ce] px-2 py-1 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => {
                  const active = r.code === selectedCode;
                  return (
                    <tr
                      key={`${r.object}:${r.code}`}
                      className={cn(
                        "cursor-pointer",
                        active ? "bg-[#fff3c4]" : i % 2 ? "bg-[#f6f8fa]" : "bg-white",
                        "hover:bg-[#fff8dc]",
                      )}
                      onClick={() => onSelect(r.code)}
                    >
                      <td className="border-b border-[#dde4eb] px-2 py-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(r.code);
                          }}
                          aria-current={active ? "true" : undefined}
                          className="flex items-center gap-1 font-mono text-[11px] font-semibold text-[#14202c] outline-none focus-visible:underline"
                        >
                          <LinkArrow />
                          {r.code}
                        </button>
                      </td>
                      <td className="max-w-[150px] truncate border-b border-[#dde4eb] px-2 py-1" title={r.name}>
                        {r.name}
                      </td>
                      <td className="border-b border-[#dde4eb] px-2 py-1 whitespace-nowrap text-[#4a5d70]">{formatSgtDate(r.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p className="border-t border-[#c3ced9] px-3 py-1.5 text-[10.5px] text-[#5b6f83]">
          {visible.length} of {records.length} record(s) · newest first
        </p>
      </aside>

      <div className="min-w-0 p-4">
        {selected ? (
          <RecordForm key={`${selected.object}:${selected.code}`} record={selected} onClose={() => onSelect(null)} />
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-[#a9b7c5] bg-white/60 text-center">
            <p className="text-[12.5px] font-semibold text-[#14202c]">Choose a record from the list</p>
            <p className="max-w-sm text-[11.5px] text-[#4a5d70]">
              Records created through OneRecord carry the request ID in the user-defined field U_OneRecordRef, so every one traces back to its approvals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecordForm({ record, onClose }: { record: SapRecord; onClose: () => void }) {
  const request = useSandbox((s) => (record.requestId ? s.requests.find((r) => r.id === record.requestId) : undefined));
  const domain = useSandbox((s) => (request ? s.config.domains.find((d) => d.id === request.domainId) : undefined));
  const fields = useMemo(() => resolveRecordFields(record, request, domain), [record, request, domain]);
  const sensitiveKeys = useMemo(
    () => new Set<string>((domain?.fields ?? []).filter((f) => f.sensitive && f.sapField).map((f) => f.sapField as string)),
    [domain],
  );
  const kind = objectKind(record.object);
  const reqId = record.requestId ?? pick(fields, "U_OneRecordRef");
  const auditKey = reqId ?? record.code;

  /** Value cell: masked when the column is sensitive, otherwise plain. */
  const v = (...names: string[]) => {
    const value = pick(fields, ...names);
    if (value === undefined) return undefined;
    const sensitive = names.some((n) => isSensitiveColumn(n, sensitiveKeys));
    return sensitive ? <MaskedValue value={value} requestId={auditKey} fieldKey={names[0]} /> : value;
  };

  const title = kind === "item" ? "Item Master Data" : kind === "profit" ? "Profit Center - Setup" : kind === "bp" ? "Business Partner Master Data" : "Master Data";

  return (
    <section aria-label={`${title}: ${record.code}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-[#c3ced9] pb-2">
        <h3 className="text-[13px] font-semibold text-[#14202c]">{title}</h3>
        <span className="rounded-[3px] border border-[#a9b7c5] bg-white px-1.5 text-[10.5px] text-[#4a5d70]">{record.object}</span>
        <span className="ml-auto text-[11px] text-[#5b6f83]">Created {formatSgtDateTime(record.createdAt)}</span>
      </div>

      {kind === "bp" ? <BusinessPartnerForm record={record} fields={fields} v={v} reqId={reqId} /> : null}
      {kind === "item" ? <ItemForm record={record} fields={fields} v={v} reqId={reqId} /> : null}
      {kind === "profit" ? (
        <SapFieldGrid>
          <SapField label="Profit Center" mono>{record.code}</SapField>
          <SapField label="Dimension">{v("InWhichDimension", "DimCode")}</SapField>
          <SapField label="Name">{v("CenterName", "PrcName") ?? record.name}</SapField>
          <SapField label="Effective From">{v("EffectiveFrom", "ValidFrom")}</SapField>
          <SapField label="Group">{v("GroupCode", "GrpCode")}</SapField>
          <SapField label="Effective To">{v("EffectiveTo", "ValidTo")}</SapField>
          <SapField label="Cost Center Type">{v("CostCenterType", "CCTypeCode")}</SapField>
          <SapField label="Active">{yesNo(pick(fields, "Active")) ?? "Yes"}</SapField>
          <RequestLink reqId={reqId} />
        </SapFieldGrid>
      ) : null}
      {kind === "other" ? (
        <SapFieldGrid>
          {Object.entries(record.fields).map(([k, val]) => (
            <SapField key={k} label={k}>
              {isSensitiveColumn(k, sensitiveKeys) ? <MaskedValue value={val} requestId={auditKey} fieldKey={k} /> : val}
            </SapField>
          ))}
          <RequestLink reqId={reqId} />
        </SapFieldGrid>
      ) : null}

      <div className="mt-4 flex gap-2">
        <SapButton onClick={onClose}>OK</SapButton>
        <SapButton variant="secondary" onClick={onClose}>
          Cancel
        </SapButton>
      </div>
    </section>
  );
}

type Getter = (...names: string[]) => React.ReactNode | undefined;

function RequestLink({ reqId }: { reqId?: string }) {
  return (
    <SapField label="OneRecord request (U_OneRecordRef)" linked={Boolean(reqId)}>
      {reqId ? (
        <Link href={`/requests/view?id=${encodeURIComponent(reqId)}`} className="font-mono text-[11px] text-[#1d5fa8] underline-offset-2 hover:underline">
          {reqId}
        </Link>
      ) : undefined}
    </SapField>
  );
}

type BpTab = "general" | "contacts" | "addresses" | "terms" | "accounting" | "bank";

function BusinessPartnerForm({
  record,
  fields,
  v,
  reqId,
}: {
  record: SapRecord;
  fields: Record<string, string>;
  v: Getter;
  reqId?: string;
}) {
  const [tab, setTab] = useState<BpTab>("general");
  const contact = childFields(fields, "ContactEmployees");
  const address = childFields(fields, "BPAddresses");
  const addr = (k: string, ...alts: string[]) => address[k] ?? pick(fields, k, ...alts);
  const contactName = contact.Name ?? pick(fields, "ContactPerson", "CntctPrsn");

  return (
    <>
      <SapFieldGrid>
        <SapField label="Code" mono>{record.code}</SapField>
        <SapField label="Type">{cardTypeLabel(pick(fields, "CardType"), record.code)}</SapField>
        <SapField label="Name">{v("CardName") ?? record.name}</SapField>
        <SapField label="Telephone 1">{v("Phone1")}</SapField>
        <SapField label="Foreign Name">{v("CardForeignName", "CardFName")}</SapField>
        <SapField label="E-Mail">{v("EmailAddress", "E_Mail")}</SapField>
        <SapField label="Group" linked>{v("GroupCode", "GroupName")}</SapField>
        <SapField label="Federal Tax ID">{v("FederalTaxID", "LicTradNum")}</SapField>
        <SapField label="Currency" linked>{v("Currency") ?? "SGD"}</SapField>
        <RequestLink reqId={reqId} />
      </SapFieldGrid>

      <SapTabs
        ariaLabel="Business partner tabs"
        className="mt-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "general", label: "General" },
          { id: "contacts", label: "Contact Persons" },
          { id: "addresses", label: "Addresses" },
          { id: "terms", label: "Payment Terms" },
          { id: "accounting", label: "Accounting" },
          { id: "bank", label: "Bank" },
        ]}
      />
      <SapTabPanel>
        {tab === "general" ? (
          <SapFieldGrid>
            <SapField label="Tel 2">{v("Phone2")}</SapField>
            <SapField label="Contact Person">{contactName}</SapField>
            <SapField label="Mobile Phone">{v("Cellular")}</SapField>
            <SapField label="Sales Employee" linked>{v("SalesPersonCode", "SlpCode")}</SapField>
            <SapField label="Web Site">{v("Website", "IntrntSite")}</SapField>
            <SapField label="Industry">{v("Industry", "segment")}</SapField>
            <SapField label="Active">{yesNo(pick(fields, "Valid", "validFor")) ?? "Yes"}</SapField>
            <SapField label="Remarks">{v("Notes", "Free_Text")}</SapField>
          </SapFieldGrid>
        ) : null}
        {tab === "contacts" ? (
          <SapMatrix
            caption="Contact persons"
            columns={["Contact ID", "Position", "Telephone", "E-Mail"]}
            rows={
              contactName
                ? [[contactName, contact.Position ?? "", contact.Phone1 ?? contact.Tel1 ?? "", contact.E_Mail ?? contact.EmailAddress ?? ""]]
                : []
            }
            emptyText="No contact persons on this record"
          />
        ) : null}
        {tab === "addresses" ? (
          <SapMatrix
            caption="Addresses"
            columns={["Address ID", "Type", "Street", "Zip Code", "City", "Country"]}
            rows={
              addr("Street")
                ? (["Bill To", "Ship To"] as const).map((type) => [
                    address.AddressName ?? (type === "Bill To" ? "BILL TO" : "SHIP TO"),
                    type,
                    addr("Street") ?? "",
                    addr("ZipCode") ?? "",
                    addr("City") ?? "",
                    addr("Country") ?? record.code.split("-")[1] ?? "",
                  ])
                : []
            }
            emptyText="No addresses on this record"
          />
        ) : null}
        {tab === "terms" ? (
          <SapFieldGrid>
            <SapField label="Payment Terms" linked>{v("PayTermsGrpCode", "PaymentTerms", "GroupNum")}</SapField>
            <SapField label="Credit Limit">{v("CreditLimit", "CreditLine")}</SapField>
            <SapField label="Price List" linked>{v("PriceListNum", "ListNum")}</SapField>
            <SapField label="Commitment Limit">{v("MaxCommitment", "DebtLine")}</SapField>
            <p className="text-[11px] text-[#5b6f83] sm:col-span-2">
              Payment terms and credit limits are visible to Finance and MDM only. Each reveal is written to the audit trail.
            </p>
          </SapFieldGrid>
        ) : null}
        {tab === "accounting" ? (
          <SapFieldGrid>
            <SapField label="Accounts Receivable" linked>{v("DebitorAccount", "DebPayAcct")}</SapField>
            <SapField label="Tax Status">{v("VatLiable", "VatStatus") ?? "Liable"}</SapField>
            <SapField label="Tax Group" linked>{v("VatGroup")}</SapField>
            <SapField label="Federal Tax ID">{v("FederalTaxID", "LicTradNum")}</SapField>
          </SapFieldGrid>
        ) : null}
        {tab === "bank" ? (
          <SapFieldGrid>
            <SapField label="Bank Country">{v("BPBankAccounts.Country", "BankCountry")}</SapField>
            <SapField label="Bank Code" linked>{v("BPBankAccounts.BankCode", "BankCode")}</SapField>
            <SapField label="Account No.">{v("BPBankAccounts.AccountNo", "AccountNo", "Account")}</SapField>
            <SapField label="Account Name">{v("BPBankAccounts.AccountName", "AccountName", "AcctName")}</SapField>
            <SapField label="SWIFT/BIC">{v("BPBankAccounts.BICSwiftCode", "BICSwiftCode", "SwiftNum")}</SapField>
            <SapField label="IBAN">{v("BPBankAccounts.IBAN", "IBAN")}</SapField>
            <p className="text-[11px] text-[#5b6f83] sm:col-span-2">
              Bank details are visible to Finance and MDM only. Each reveal is written to the audit trail.
            </p>
          </SapFieldGrid>
        ) : null}
      </SapTabPanel>
    </>
  );
}

type ItemTab = "general" | "purchasing" | "sales" | "inventory" | "properties";

function ItemForm({
  record,
  fields,
  v,
  reqId,
}: {
  record: SapRecord;
  fields: Record<string, string>;
  v: Getter;
  reqId?: string;
}) {
  const [tab, setTab] = useState<ItemTab>("general");
  const group = record.code.match(/^I-([ABC])-/)?.[1] as "A" | "B" | "C" | undefined;
  const category = pick(fields, "U_Category", "category", "Category");
  const flag = (name: string, fallback = "tYES") => (pick(fields, name) ?? fallback) === "tYES" || pick(fields, name) === "Y";
  const properties: { label: string; on: boolean }[] = [
    { label: "Product A · IVD reagents", on: group === "A" },
    { label: "Product B · Lab consumables", on: group === "B" },
    { label: "Product C · Instruments", on: group === "C" },
    { label: "IVD reagent", on: /ivd/i.test(category ?? "") || group === "A" },
    { label: "Medical device", on: /medical device/i.test(category ?? "") },
    { label: "Regulated (HSA / MDA licence)", on: Boolean(pick(fields, "U_RegLicenceNo", "U_RegLicence", "regLicenceNo")) || /ivd|medical device/i.test(category ?? "") },
    { label: "Batch managed", on: flag("ManageBatchNumbers", group === "A" ? "tYES" : "tNO") },
    { label: "Cold chain (2–8 °C)", on: /cold|2-8|2–8/i.test(pick(fields, "U_StorageCond", "U_Storage", "storage") ?? "") },
  ];

  return (
    <>
      <SapFieldGrid>
        <SapField label="Item No." mono>{record.code}</SapField>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[#2c3e50]">
          <SapCheck label="Inventory Item" on={flag("InventoryItem")} />
          <SapCheck label="Sales Item" on={flag("SalesItem")} />
          <SapCheck label="Purchase Item" on={flag("PurchaseItem")} />
        </div>
        <SapField label="Description">{v("ItemName") ?? record.name}</SapField>
        <SapField label="Foreign Name">{v("ForeignName", "FrgnName")}</SapField>
        <SapField label="Item Type">Items</SapField>
        <SapField label="Bar Code">{v("BarCode", "CodeBars")}</SapField>
        <SapField label="Item Group" linked>
          {itemGroupLabel(pick(fields, "ItemsGroupCode", "ItmsGrpCod"), group)}
        </SapField>
        <SapField label="UoM Group" linked>{v("InventoryUOM", "InvntryUom", "SalesUnit", "uom")}</SapField>
        <RequestLink reqId={reqId} />
      </SapFieldGrid>

      <SapTabs
        ariaLabel="Item tabs"
        className="mt-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "general", label: "General" },
          { id: "purchasing", label: "Purchasing Data" },
          { id: "sales", label: "Sales Data" },
          { id: "inventory", label: "Inventory Data" },
          { id: "properties", label: "Properties" },
        ]}
      />
      <SapTabPanel>
        {tab === "general" ? (
          <SapFieldGrid>
            <SapField label="Manufacturer" linked>{v("U_Manufacturer", "Manufacturer", "FirmCode", "manufacturer")}</SapField>
            <SapField label="Manage Item by">{flag("ManageBatchNumbers", group === "A" ? "tYES" : "tNO") ? "Batches" : flag("ManageSerialNumbers", "tNO") ? "Serial Numbers" : "None"}</SapField>
            <SapField label="Category">{category}</SapField>
            <SapField label="Regulatory Licence No.">{v("U_RegLicenceNo", "U_RegLicence", "regLicenceNo")}</SapField>
            <SapField label="Pack Size">{v("U_PackSize", "SalesItemsPerUnit", "packSize")}</SapField>
            <SapField label="Storage">{v("U_StorageCond", "U_Storage", "storage")}</SapField>
            <SapField label="Active">{yesNo(pick(fields, "Valid", "validFor")) ?? "Yes"}</SapField>
            <SapField label="Remarks">{v("User_Text", "UserText")}</SapField>
          </SapFieldGrid>
        ) : null}
        {tab === "purchasing" ? (
          <SapFieldGrid>
            <SapField label="Preferred Vendor" linked>{v("Mainsupplier", "CardCode")}</SapField>
            <SapField label="Mfr Catalog No.">{v("SupplierCatalogNo", "SuppCatNum")}</SapField>
            <SapField label="Purchasing UoM">{v("PurchaseUnit", "BuyUnitMsr")}</SapField>
            <SapField label="Items per Purchase Unit">{v("PurchaseItemsPerUnit", "NumInBuy")}</SapField>
            <SapField label="Lead Time (Days)">{v("LeadTime")}</SapField>
            <SapField label="Customs Group">{v("CustomsGroupCode")}</SapField>
          </SapFieldGrid>
        ) : null}
        {tab === "sales" ? (
          <SapFieldGrid>
            <SapField label="Sales UoM">{v("SalesUnit", "SalUnitMsr")}</SapField>
            <SapField label="Items per Sales Unit">{v("SalesItemsPerUnit", "NumInSale")}</SapField>
            <SapField label="Sales Tax Group" linked>{v("SalesVATGroup", "VatGourpSa")}</SapField>
            <SapField label="Packaging UoM">{v("SalesPackagingUnit", "SalPackMsr")}</SapField>
          </SapFieldGrid>
        ) : null}
        {tab === "inventory" ? (
          <SapFieldGrid>
            <SapField label="Inventory UoM">{v("InventoryUOM", "InvntryUom")}</SapField>
            <SapField label="Default Warehouse" linked>{v("DefaultWarehouse", "DfltWH")}</SapField>
            <SapField label="Minimum Order Qty">{v("MinOrderQuantity", "MinOrdrQty")}</SapField>
            <SapField label="Valuation Method">{v("CostAccountingMethod", "EvalSystem") ?? "Moving Average"}</SapField>
            <SapField label="Planning Method">{v("PlanningSystem", "PlaningSys")}</SapField>
            <SapField label="Procurement Method">{v("ProcurementMethod", "PrcrmntMtd") ?? "Buy"}</SapField>
          </SapFieldGrid>
        ) : null}
        {tab === "properties" ? (
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {properties.map((p, i) => (
              <div key={p.label} className="flex items-center gap-2 text-[11.5px] text-[#2c3e50]">
                <span className="w-5 text-right text-[#6b7d8f] tabular-nums">{i + 1}</span>
                <SapCheck label={p.label} on={p.on} />
              </div>
            ))}
          </div>
        ) : null}
      </SapTabPanel>
    </>
  );
}

/** "101 · Product A · IVD reagents & test kits"; a bare letter code shows just the label. */
function itemGroupLabel(raw: string | undefined, group: "A" | "B" | "C" | undefined): string | undefined {
  const letter = raw && /^[ABC]$/.test(raw) ? (raw as "A" | "B" | "C") : group;
  const label = letter ? PRODUCT_LABELS[letter] : undefined;
  if (raw && !/^[ABC]$/.test(raw)) return label ? `${raw} · ${label}` : raw;
  return label;
}

function SapCheck({ label, on }: { label: string; on: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        role="img"
        aria-label={on ? "Checked" : "Not checked"}
        className={cn(
          "inline-flex size-[13px] items-center justify-center border text-[10px] leading-none",
          on ? "border-[#5b6f83] bg-white text-[#14202c]" : "border-[#a9b7c5] bg-white text-transparent",
        )}
      >
        ✓
      </span>
      {label}
    </span>
  );
}

