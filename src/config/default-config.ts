import type { AppConfig, BusinessUnit, DomainConfig, FieldDef, RoleId } from "@/lib/types";
import { PEOPLE } from "@/config/people";

/**
 * Default OneRecord configuration (version 1).
 *
 * Field keys are the shared vocabulary for intake, routing, masking, DTW export and seed data.
 * `sapField` is the SAP Business One DI API / Service Layer / DTW property the field lands in.
 * Header properties are bare (e.g. "CardName"); child-collection properties are prefixed with
 * their DTW child object (e.g. "BPAddresses.Street", "BPBankAccounts.AccountNo").
 * Properties starting with "U_" are user-defined fields appended to the DTW template.
 * maxLength mirrors the SAP column sizes from the research log (CardName 100, LicTradNum 32,
 * E_Mail 100, Phone1 20, ItemName 100, PrcCode 8, PrcName 30, Currency 3, CardCode 15).
 */

/** Categories that need a regulatory licence + certificate and a QA/RA review. */
export const REGULATED_CATEGORIES = ["IVD reagent", "Lab consumable – IVD medical device", "Medical device"] as const;

/** Amy's live demo item category (App C): a lab consumable that is regulated as an IVD medical device. */
export const IVD_CONSUMABLE_CATEGORY = "Lab consumable – IVD medical device";

export const ITEM_CATEGORIES = [
  "IVD reagent",
  "Lab consumable – IVD medical device",
  "Medical device",
  "Lab consumable",
  "Instrument",
  "Spare part",
  "Service",
] as const;

export const CUSTOMER_SEGMENTS = [
  "Public hospital",
  "Private hospital",
  "Diagnostic lab",
  "Clinic",
  "Research/academic",
  "Industry",
] as const;

export const PAYMENT_TERMS = ["Cash on delivery", "Net 30", "Net 45", "Net 60", "Net 90"] as const;
export const CURRENCIES = ["SGD", "MYR", "THB", "VND", "MMK", "USD"] as const;
export const UOM_CODES = ["KIT", "BOX", "PCK", "EA", "BTL", "CS"] as const;
export const STORAGE_CONDITIONS = [
  "Ambient (15–30 °C)",
  "Refrigerated (2–8 °C)",
  "Frozen (−20 °C)",
  "Ultra-low (−80 °C)",
] as const;

const PHONE_PATTERN = "^\\+?[0-9][0-9 ()-]{6,19}$";
const PHONE_HINT = "International format, e.g. +60 3 7491 9191";
const POSTCODE_PATTERN = "^[0-9]{5,6}$";
const POSTCODE_HINT = "5–6 digits, e.g. 119074 (SG) or 47500 (MY)";
const SWIFT_PATTERN = "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$";
const SWIFT_HINT = "8 or 11 characters, e.g. MBBEMYKL or UOVBSGSGXXX";
const ACCOUNT_PATTERN = "^[0-9][0-9 -]{5,33}$";
const ACCOUNT_HINT = "6–34 digits; spaces and dashes allowed";
const TAX_HELP = "UEN (SG) · SST / BRN (MY) · 13-digit TIN (TH) · MST (VN) · company registration no. (MM)";

// ---------------------------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------------------------

const customerFields: FieldDef[] = [
  {
    key: "customerName",
    label: "Customer name",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "CardName",
    section: "Company",
    helpText: "Registered legal name. We check existing records as you type.",
  },
  { key: "country", label: "Country", type: "country", required: true, sapField: "BPAddresses.Country", section: "Company" },
  {
    key: "entity",
    label: "Selling entity",
    type: "entity",
    required: true,
    sapField: "U_Entities",
    section: "Company",
    helpText: "The Lives Group business unit that will invoice this customer.",
  },
  {
    key: "taxId",
    label: "Tax / registration no.",
    type: "text",
    required: true,
    maxLength: 32,
    sapField: "FederalTaxID",
    section: "Company",
    helpText: TAX_HELP,
  },
  {
    key: "segment",
    label: "Customer segment",
    type: "select",
    required: true,
    options: [...CUSTOMER_SEGMENTS],
    sapField: "GroupCode",
    helpText: "Sets the SAP B1 customer group.",
    section: "Company",
  },
  {
    key: "street",
    label: "Street address",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "BPAddresses.Street",
    section: "Address & contact",
  },
  { key: "city", label: "City", type: "text", required: true, maxLength: 100, sapField: "BPAddresses.City", section: "Address & contact" },
  {
    key: "zipCode",
    label: "Postcode",
    type: "text",
    required: true,
    maxLength: 20,
    pattern: POSTCODE_PATTERN,
    patternHint: POSTCODE_HINT,
    sapField: "BPAddresses.ZipCode",
    section: "Address & contact",
  },
  {
    key: "phone",
    label: "Main phone",
    type: "phone",
    required: true,
    maxLength: 20,
    pattern: PHONE_PATTERN,
    patternHint: PHONE_HINT,
    sapField: "Phone1",
    section: "Address & contact",
  },
  {
    key: "email",
    label: "Accounts payable email",
    type: "email",
    required: true,
    maxLength: 100,
    sapField: "EmailAddress",
    section: "Address & contact",
    helpText: "Where invoices and statements are sent.",
  },
  {
    key: "contactPerson",
    label: "Contact person",
    type: "text",
    required: true,
    maxLength: 50,
    sapField: "ContactPerson",
    section: "Address & contact",
  },
  {
    key: "paymentTerms",
    label: "Payment terms",
    type: "select",
    required: true,
    options: [...PAYMENT_TERMS],
    sensitive: true,
    sapField: "PayTermsGrpCode",
    section: "Credit & banking",
  },
  {
    key: "creditLimit",
    label: "Credit limit (SGD)",
    type: "number",
    required: true,
    sensitive: true,
    sapField: "CreditLimit",
    section: "Credit & banking",
    helpText: "Above S$50,000 adds a Finance Director approval.",
  },
  {
    key: "currency",
    label: "Billing currency",
    type: "select",
    required: true,
    options: [...CURRENCIES],
    maxLength: 3,
    sapField: "Currency",
    section: "Credit & banking",
  },
  {
    key: "bankName",
    label: "Customer bank",
    type: "text",
    required: false,
    maxLength: 50,
    sensitive: true,
    sapField: "BPBankAccounts.U_BankName",
    section: "Credit & banking",
    helpText: "Needed only for customers paying by direct debit or receiving refunds.",
  },
  {
    key: "bankAccountNo",
    label: "Bank account no.",
    type: "text",
    required: false,
    maxLength: 50,
    pattern: ACCOUNT_PATTERN,
    patternHint: ACCOUNT_HINT,
    sensitive: true,
    sapField: "BPBankAccounts.AccountNo",
    section: "Credit & banking",
  },
  {
    key: "swift",
    label: "SWIFT / BIC",
    type: "text",
    required: false,
    maxLength: 11,
    pattern: SWIFT_PATTERN,
    patternHint: SWIFT_HINT,
    sensitive: true,
    sapField: "BPBankAccounts.BICSwiftCode",
    section: "Credit & banking",
  },
];

const vendorFields: FieldDef[] = [
  {
    key: "vendorName",
    label: "Vendor name",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "CardName",
    section: "Company",
    helpText: "Registered legal name as on the supplier's invoice.",
  },
  { key: "country", label: "Country", type: "country", required: true, sapField: "BPAddresses.Country", section: "Company" },
  {
    key: "taxId",
    label: "Tax / registration no.",
    type: "text",
    required: true,
    maxLength: 32,
    sapField: "FederalTaxID",
    section: "Company",
    helpText: TAX_HELP,
  },
  {
    key: "suppliesRegulated",
    label: "Supplies regulated products?",
    type: "select",
    required: true,
    options: ["Yes", "No"],
    sapField: "U_Regulated",
    section: "Company",
    helpText: "IVD reagents or medical devices. Yes adds a QA/RA review of the supplier's licences.",
  },
  {
    key: "street",
    label: "Street address",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "BPAddresses.Street",
    section: "Address & contact",
  },
  {
    key: "zipCode",
    label: "Postcode",
    type: "text",
    required: true,
    maxLength: 20,
    pattern: POSTCODE_PATTERN,
    patternHint: POSTCODE_HINT,
    sapField: "BPAddresses.ZipCode",
    section: "Address & contact",
  },
  {
    key: "phone",
    label: "Main phone",
    type: "phone",
    required: true,
    maxLength: 20,
    pattern: PHONE_PATTERN,
    patternHint: PHONE_HINT,
    sapField: "Phone1",
    section: "Address & contact",
  },
  {
    key: "email",
    label: "Accounts receivable email",
    type: "email",
    required: true,
    maxLength: 100,
    sapField: "EmailAddress",
    section: "Address & contact",
    helpText: "Where remittance advice is sent.",
  },
  {
    key: "bankName",
    label: "Vendor bank",
    type: "text",
    required: true,
    maxLength: 50,
    sensitive: true,
    sapField: "BPBankAccounts.U_BankName",
    section: "Banking & terms",
  },
  {
    key: "bankAccountNo",
    label: "Bank account no.",
    type: "text",
    required: true,
    maxLength: 50,
    pattern: ACCOUNT_PATTERN,
    patternHint: ACCOUNT_HINT,
    sensitive: true,
    sapField: "BPBankAccounts.AccountNo",
    section: "Banking & terms",
    helpText: "Finance verifies this by calling the vendor back on a known number.",
  },
  {
    key: "swift",
    label: "SWIFT / BIC",
    type: "text",
    required: true,
    maxLength: 11,
    pattern: SWIFT_PATTERN,
    patternHint: SWIFT_HINT,
    sensitive: true,
    sapField: "BPBankAccounts.BICSwiftCode",
    section: "Banking & terms",
  },
  {
    key: "paymentTerms",
    label: "Payment terms",
    type: "select",
    required: true,
    options: [...PAYMENT_TERMS],
    sensitive: true,
    sapField: "PayTermsGrpCode",
    section: "Banking & terms",
  },
];

const itemFields: FieldDef[] = [
  {
    key: "itemName",
    label: "Item description",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "ItemName",
    section: "Product",
    helpText: "Brand-neutral name, pack size last, e.g. Dengue NS1 Ag Rapid Test 25T.",
  },
  {
    key: "category",
    label: "Category",
    type: "select",
    required: true,
    options: [...ITEM_CATEGORIES],
    sapField: "U_Category",
    section: "Product",
    helpText: "IVD reagents, IVD-regulated lab consumables and medical devices need a regulatory licence, its certificate and a QA/RA review.",
  },
  {
    key: "productGroup",
    label: "Product group",
    type: "select",
    required: true,
    options: ["A", "B", "C"],
    sapField: "ItemsGroupCode",
    section: "Product",
    helpText: "A = IVD reagents & test kits · B = lab consumables · C = instruments & equipment.",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "U_Manufacturer",
    section: "Product",
  },
  {
    key: "regLicenceNo",
    label: "Regulatory licence no.",
    type: "text",
    required: false,
    requiredIf: { field: "category", op: "in", value: [...REGULATED_CATEGORIES] },
    maxLength: 50,
    sapField: "U_RegLicenceNo",
    section: "Product",
    helpText: "HSA (SG) / MDA (MY) / Thai FDA licence no.",
  },
  {
    key: "regCertificate",
    label: "Registration certificate (PDF)",
    type: "file",
    required: false,
    requiredIf: { field: "category", op: "in", value: [...REGULATED_CATEGORIES] },
    section: "Product",
    helpText: "The product registration certificate QA/RA will check against the licence number.",
  },
  {
    key: "uom",
    label: "Unit of measure",
    type: "select",
    required: true,
    options: [...UOM_CODES],
    maxLength: 5,
    sapField: "InventoryUOM",
    section: "Logistics & pricing",
  },
  {
    key: "packSize",
    label: "Units per UoM",
    type: "number",
    required: true,
    sapField: "U_PackSize",
    section: "Logistics & pricing",
    helpText: "e.g. 30 for a 30-test kit sold per KIT.",
  },
  {
    key: "costPrice",
    label: "Landed cost (SGD)",
    type: "number",
    required: true,
    sapField: "AvgStdPrice",
    section: "Logistics & pricing",
  },
  {
    key: "salesPrice",
    label: "List price (SGD)",
    type: "number",
    required: true,
    sapField: "Items_Prices.Price",
    section: "Logistics & pricing",
  },
  {
    key: "storage",
    label: "Storage condition",
    type: "select",
    required: true,
    options: [...STORAGE_CONDITIONS],
    sapField: "U_StorageCond",
    section: "Logistics & pricing",
  },
  {
    key: "entity",
    label: "Owning entity",
    type: "entity",
    required: true,
    sapField: "U_Entity",
    section: "Market",
  },
  {
    key: "countries",
    label: "Markets",
    type: "text",
    required: true,
    pattern: "^\\s*(SG|MY|TH|VN|MM)(\\s*,\\s*(SG|MY|TH|VN|MM))*\\s*$",
    patternHint: "Comma-separated country codes, e.g. MY, SG",
    sapField: "U_Markets",
    section: "Market",
    helpText: "Countries the item will be sold in.",
  },
];

const costCentreFields: FieldDef[] = [
  {
    key: "centreCode",
    label: "Proposed centre code",
    type: "text",
    required: true,
    maxLength: 8,
    pattern: "^[A-Z0-9-]{3,8}$",
    patternHint: "3–8 capital letters, digits or dashes, e.g. MY-QTS02",
    sapField: "CenterCode",
    section: "Cost centre",
    helpText: "SAP B1 profit-centre codes are limited to 8 characters.",
  },
  {
    key: "centreName",
    label: "Centre name",
    type: "text",
    required: true,
    maxLength: 30,
    sapField: "CenterName",
    section: "Cost centre",
  },
  { key: "entity", label: "Business unit", type: "entity", required: true, sapField: "U_Entity", section: "Cost centre" },
  { key: "country", label: "Country", type: "country", required: true, sapField: "U_Country", section: "Cost centre" },
  {
    key: "owner",
    label: "Budget owner",
    type: "text",
    required: true,
    maxLength: 50,
    sapField: "U_Owner",
    section: "Cost centre",
  },
  {
    key: "dimension",
    label: "Dimension",
    type: "select",
    required: true,
    options: ["1", "2", "3"],
    sapField: "InWhichDimension",
    section: "Cost centre",
    helpText: "1 = Country · 2 = Business unit · 3 = Department.",
  },
];

const extendFields: FieldDef[] = [
  {
    key: "existingCode",
    label: "Existing customer code",
    type: "text",
    required: true,
    maxLength: 15,
    pattern: "^C-(SG|MY|TH|VN|MM)-[0-9]{5}$",
    patternHint: "SAP customer code, e.g. C-MY-00031",
    sapField: "CardCode",
    section: "Existing record",
  },
  {
    key: "existingName",
    label: "Existing customer name",
    type: "text",
    required: true,
    maxLength: 100,
    sapField: "CardName",
    section: "Existing record",
  },
  {
    key: "extendToEntity",
    label: "Extend to entity",
    type: "entity",
    required: true,
    sapField: "U_Entities",
    section: "Extension",
  },
  {
    key: "newShipToAddress",
    label: "New ship-to address",
    type: "textarea",
    required: false,
    maxLength: 100,
    sapField: "BPAddresses.Street",
    section: "Extension",
    helpText: "Leave blank to keep the existing ship-to address.",
  },
  {
    key: "changesCreditTerms",
    label: "Changes credit terms?",
    type: "select",
    required: true,
    options: ["Yes", "No"],
    sapField: "U_CreditChange",
    section: "Extension",
    helpText: "Yes adds a Finance review.",
  },
  {
    key: "paymentTerms",
    label: "New payment terms",
    type: "select",
    required: false,
    requiredIf: { field: "changesCreditTerms", op: "equals", value: "Yes" },
    showIf: { field: "changesCreditTerms", op: "equals", value: "Yes" },
    options: [...PAYMENT_TERMS],
    sensitive: true,
    sapField: "PayTermsGrpCode",
    section: "Extension",
    helpText: "Applies to the whole business partner record once Finance approves.",
  },
  {
    key: "creditLimit",
    label: "New credit limit (SGD)",
    type: "number",
    required: false,
    requiredIf: { field: "changesCreditTerms", op: "equals", value: "Yes" },
    showIf: { field: "changesCreditTerms", op: "equals", value: "Yes" },
    sensitive: true,
    sapField: "CreditLimit",
    section: "Extension",
  },
  {
    key: "reason",
    label: "Business reason",
    type: "textarea",
    required: true,
    maxLength: 254,
    sapField: "FreeText",
    section: "Extension",
  },
];

export const DEFAULT_DOMAINS: DomainConfig[] = [
  {
    id: "customer",
    label: "New Customer",
    description: "Set up a hospital, lab or clinic that will buy from a Lives Group entity.",
    icon: "Building2",
    sapObject: "oBusinessPartners",
    codePrefix: "C",
    fields: customerFields,
    stages: [
      {
        id: "cust-checks",
        label: "Commercial & data checks",
        mode: "parallel",
        steps: [
          { id: "cust-bu", label: "BU Head — commercial approval", role: "bu_head" },
          { id: "cust-bs", label: "Business Support — address & tax ID", role: "business_support" },
        ],
      },
      {
        id: "cust-finance",
        label: "Finance",
        mode: "sequential",
        steps: [
          { id: "cust-fin", label: "Finance — credit terms & bank details", role: "finance" },
          {
            id: "cust-fd",
            label: "Finance Director — credit limit above S$50k",
            role: "finance_director",
            condition: { field: "creditLimit", op: "gt", value: 50000 },
          },
        ],
      },
    ],
    dupCheck: true,
    enabled: true,
  },
  {
    id: "vendor",
    label: "New Vendor",
    description: "Set up a supplier, logistics partner or service provider that Lives Group pays.",
    icon: "Truck",
    sapObject: "oBusinessPartners",
    codePrefix: "V",
    fields: vendorFields,
    stages: [
      {
        id: "vend-checks",
        label: "Supplier checks",
        mode: "parallel",
        steps: [
          { id: "vend-proc", label: "Procurement Head — supplier approval", role: "procurement" },
          {
            id: "vend-qa",
            label: "QA/RA — supplier licences & quality agreement",
            role: "qa_ra",
            condition: { field: "suppliesRegulated", op: "equals", value: "Yes" },
          },
        ],
      },
      {
        id: "vend-finance",
        label: "Finance",
        mode: "sequential",
        steps: [{ id: "vend-fin", label: "Finance — bank details (call-back verified) & terms", role: "finance" }],
      },
    ],
    dupCheck: true,
    enabled: true,
  },
  {
    id: "item",
    label: "New Item",
    description: "Create an item code for a reagent, consumable, instrument or service before it can be sold.",
    icon: "Package",
    sapObject: "oItems",
    codePrefix: "I",
    fields: itemFields,
    stages: [
      {
        id: "item-checks",
        label: "Product checks",
        mode: "parallel",
        steps: [
          {
            id: "item-qa",
            label: "QA/RA — regulatory review",
            role: "qa_ra",
            condition: { field: "category", op: "in", value: [...REGULATED_CATEGORIES] },
          },
          { id: "item-bu", label: "BU Head — commercial approval", role: "bu_head" },
          { id: "item-bs", label: "Business Support — UoM, pricing & logistics", role: "business_support" },
        ],
      },
    ],
    dupCheck: false,
    enabled: true,
  },
  {
    id: "costcentre",
    label: "New Cost Centre",
    description: "Open a profit centre for a new team, site or budget line.",
    icon: "Landmark",
    sapObject: "oProfitCenter",
    codePrefix: "CC",
    fields: costCentreFields,
    stages: [
      {
        id: "cc-checks",
        label: "Finance & ownership",
        mode: "parallel",
        steps: [
          { id: "cc-fc", label: "Financial Controller — chart of accounts", role: "financial_controller" },
          { id: "cc-bu", label: "BU Head — ownership & budget", role: "bu_head" },
        ],
      },
    ],
    dupCheck: false,
    enabled: true,
  },
  {
    id: "extend",
    label: "Extend Existing Record",
    description: "Add an entity, ship-to address or contact to a customer that already exists in SAP B1.",
    icon: "GitBranchPlus",
    sapObject: "oBusinessPartners",
    codePrefix: "C",
    fields: extendFields,
    stages: [
      {
        id: "ext-checks",
        label: "Extension checks",
        mode: "sequential",
        steps: [
          { id: "ext-bs", label: "Business Support — entity & address", role: "business_support" },
          {
            id: "ext-fin",
            label: "Finance — revised credit terms",
            role: "finance",
            condition: { field: "changesCreditTerms", op: "equals", value: "Yes" },
          },
        ],
      },
    ],
    dupCheck: false,
    enabled: true,
  },
];

// ---------------------------------------------------------------------------------------------
// Business units
// ---------------------------------------------------------------------------------------------

const SHARED_ROLES: Partial<Record<RoleId, string>> = {
  sales_manager: "lan",
  finance: "weijie",
  finance_director: "rachel",
  financial_controller: "meiling",
  procurement: "hafiz",
  qa_ra: "ploy",
  mdm: "priya",
  admin: "priya",
};

export const DEFAULT_BUSINESS_UNITS: BusinessUnit[] = [
  {
    id: "SPD",
    name: "SPD — Diagnostics",
    description: "IVD reagents and rapid test kits for hospital labs, diagnostic labs and clinics.",
    mainProduct: "A",
    roleAssignments: { ...SHARED_ROLES, bu_head: "daniel", business_support: "siti" },
    extraStages: [],
  },
  {
    id: "QTS",
    name: "QTS — Instruments",
    description: "Medical and laboratory instruments for hospitals and specialist facilities.",
    mainProduct: "C",
    roleAssignments: { ...SHARED_ROLES, bu_head: "jun", business_support: "kyaw" },
    extraStages: [],
  },
  {
    id: "QTG",
    name: "QTG — Lab Essentials",
    description: "Lab and life-science consumables for research labs, industry and hospital labs.",
    mainProduct: "B",
    roleAssignments: { ...SHARED_ROLES, bu_head: "aisha", business_support: "siti" },
    extraStages: [],
  },
];

/**
 * Marcus's business unit, NOT part of the default config. The admin demo adds it ("Add business
 * unit") and the next request from Marcus routes to its approvers plus its extra regulatory step.
 * Admin screens may use it to prefill the form.
 */
export const NEW_BU_TEMPLATE: BusinessUnit = {
  id: "MLS",
  name: "MLS — Meridian Life Sciences",
  description: "Molecular diagnostics and PCR workflow products; joined Lives Group in 2026.",
  mainProduct: "A",
  roleAssignments: { ...SHARED_ROLES, bu_head: "henry", sales_manager: "marcus", business_support: "siti" },
  extraStages: [
    {
      id: "mls-regulatory",
      label: "Molecular regulatory pre-check",
      mode: "sequential",
      // Product (item) requests only: they are the only ones that carry a product group. Customer
      // extensions, vendors etc. raised in MLS skip it (no molecular product to check).
      steps: [
        {
          id: "mls-reg",
          label: "QA/RA — molecular IVD pre-market check",
          role: "qa_ra",
          condition: { field: "productGroup", op: "notEmpty" },
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// App config
// ---------------------------------------------------------------------------------------------

/** OneRecord went live 90 days before the demo window; version 1 is the go-live configuration. */
export const CONFIG_GO_LIVE_AT = "2026-07-27T01:00:00.000Z";

export const DEFAULT_CONFIG: AppConfig = {
  version: 1,
  domains: DEFAULT_DOMAINS,
  businessUnits: DEFAULT_BUSINESS_UNITS,
  people: PEOPLE,
  sla: { stepBusinessDays: 2, reminderAfterBusinessDays: 1, escalateAfterBusinessDays: 3 },
  history: [
    {
      version: 1,
      at: CONFIG_GO_LIVE_AT,
      byId: "priya",
      summary: "Go-live configuration: 5 request types, 3 business units, A9 approval matrix, 2-day step SLA",
    },
  ],
};

/** A deep copy of the default config, safe to mutate. */
export function cloneDefaultConfig(): AppConfig {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;
}

/** The field holding the record's display name, per domain. */
export const PRIMARY_NAME_FIELD: Record<string, string> = {
  customer: "customerName",
  vendor: "vendorName",
  item: "itemName",
  costcentre: "centreName",
  extend: "existingName",
};
