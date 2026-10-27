/**
 * Test fixtures for the engine. They mirror the shape of DEFAULT_CONFIG described in the
 * build plan (field keys, A9 approval matrix, pinned personas) without importing it, so the
 * engine tests stay independent of the config module.
 */
import type { BusinessUnit, CustomerMaster, DomainConfig, Person, SlaConfig } from "@/lib/types";

export const SLA: SlaConfig = { stepBusinessDays: 2, reminderAfterBusinessDays: 1, escalateAfterBusinessDays: 3 };

function person(p: Partial<Person> & Pick<Person, "id" | "name" | "roles">): Person {
  return {
    title: "",
    entity: "SPD",
    country: "SG",
    email: `${p.id}@livesgroup.example`,
    persona: false,
    avatarColor: "#475569",
    ...p,
  };
}

export const PEOPLE: Person[] = [
  person({ id: "amy", name: "Amy Lim", roles: ["requestor"], persona: true, managerId: "daniel" }),
  person({ id: "weijie", name: "Tan Wei Jie", roles: ["finance"], persona: true, managerId: "rachel" }),
  person({ id: "priya", name: "Priya Nair", roles: ["mdm", "admin"], persona: true, managerId: "meiling" }),
  person({ id: "marcus", name: "Marcus Wong", roles: ["bu_head"], persona: true }),
  person({ id: "daniel", name: "Daniel Ong", roles: ["bu_head"], managerId: "rachel" }),
  person({ id: "siti", name: "Siti Rahman", roles: ["business_support"], country: "MY", managerId: "daniel" }),
  person({ id: "ploy", name: "Dr Ploy Srisuk", roles: ["qa_ra"], country: "TH", managerId: "daniel" }),
  person({ id: "lan", name: "Nguyen Thi Lan", roles: ["sales_manager"], country: "VN", managerId: "daniel" }),
  person({ id: "kyaw", name: "Kyaw Zin Htet", roles: ["business_support"], country: "MM", managerId: "siti" }),
  person({ id: "rachel", name: "Rachel Koh", roles: ["finance_director"] }),
  person({ id: "hafiz", name: "Hafiz Ismail", roles: ["procurement"], country: "MY", managerId: "rachel" }),
  person({ id: "meiling", name: "Chua Mei Ling", roles: ["financial_controller"], managerId: "rachel" }),
  person({ id: "jun", name: "Lim Jun Hao", roles: ["bu_head"], entity: "QTS" }),
  person({ id: "aisha", name: "Aisha Karim", roles: ["bu_head"], entity: "QTG" }),
];

export const SPD: BusinessUnit = {
  id: "SPD",
  name: "SPD — Diagnostics",
  description: "IVD reagents and test kits",
  mainProduct: "A",
  roleAssignments: {
    bu_head: "daniel",
    business_support: "siti",
    qa_ra: "ploy",
    finance: "weijie",
    finance_director: "rachel",
    financial_controller: "meiling",
    procurement: "hafiz",
    sales_manager: "lan",
    mdm: "priya",
  },
  extraStages: [],
};

const CATEGORY_OPTIONS = ["IVD reagent", "Medical device", "Lab consumable", "Instrument", "Other"];

export const ITEM: DomainConfig = {
  id: "item",
  label: "New Item",
  description: "Create a new item master record",
  icon: "Package",
  sapObject: "oItems",
  codePrefix: "I",
  dupCheck: false,
  enabled: true,
  fields: [
    { key: "itemName", label: "Item name", type: "text", required: true, maxLength: 100, sapField: "ItemName" },
    { key: "category", label: "Category", type: "select", required: true, options: CATEGORY_OPTIONS },
    { key: "productGroup", label: "Product group", type: "select", required: true, options: ["A", "B", "C"], sapField: "ItemsGroupCode" },
    { key: "manufacturer", label: "Manufacturer", type: "text", required: true },
    { key: "uom", label: "Unit of measure", type: "select", required: true, options: ["BOX", "KIT", "EA", "PK", "BTL", "VIAL"], sapField: "InventoryUOM" },
    { key: "packSize", label: "Pack size", type: "text", required: false },
    { key: "costPrice", label: "Cost price (SGD)", type: "number", required: true },
    { key: "salesPrice", label: "Selling price (SGD)", type: "number", required: true },
    { key: "storage", label: "Storage condition", type: "text", required: false },
    {
      key: "regLicenceNo",
      label: "Regulatory licence no. (HSA / MDA)",
      type: "text",
      required: false,
      requiredIf: { field: "category", op: "in", value: ["IVD reagent", "Medical device"] },
      sapField: "U_RegLicenceNo",
    },
    { key: "entity", label: "Entity", type: "entity", required: true },
    { key: "countries", label: "Countries sold in", type: "text", required: false },
  ],
  stages: [
    {
      id: "item-review",
      label: "Business review",
      mode: "parallel",
      steps: [
        {
          id: "qa_ra",
          label: "QA/RA — regulatory licence",
          role: "qa_ra",
          condition: { field: "category", op: "in", value: ["IVD reagent", "Medical device"] },
        },
        { id: "bu_head", label: "BU Head — commercial", role: "bu_head" },
        { id: "business_support", label: "Business Support — UoM, pricing, logistics", role: "business_support" },
      ],
    },
  ],
};

export const CUSTOMER: DomainConfig = {
  id: "customer",
  label: "New Customer",
  description: "Create a new customer business partner",
  icon: "Building2",
  sapObject: "oBusinessPartners",
  codePrefix: "C",
  dupCheck: true,
  enabled: true,
  fields: [
    { key: "customerName", label: "Customer name", type: "text", required: true, maxLength: 100, sapField: "CardName" },
    { key: "country", label: "Country", type: "country", required: true },
    { key: "entity", label: "Entity", type: "entity", required: true },
    { key: "taxId", label: "Tax ID / UEN", type: "text", required: true, maxLength: 32, sapField: "FederalTaxID" },
    { key: "street", label: "Street", type: "text", required: true, sapField: "BPAddresses.Street" },
    { key: "city", label: "City", type: "text", required: false, sapField: "BPAddresses.City" },
    { key: "zipCode", label: "Postcode", type: "text", required: true, sapField: "BPAddresses.ZipCode" },
    { key: "phone", label: "Phone", type: "phone", required: true, maxLength: 20, sapField: "Phone1" },
    { key: "email", label: "Email", type: "email", required: false, maxLength: 100, sapField: "EmailAddress" },
    { key: "contactPerson", label: "Contact person", type: "text", required: false },
    {
      key: "segment",
      label: "Segment",
      type: "select",
      required: true,
      options: ["Public hospital", "Private hospital", "Diagnostic lab", "Clinic", "Research/academic", "Industry"],
    },
    { key: "paymentTerms", label: "Payment terms", type: "select", required: true, sensitive: true, options: ["Net 30", "Net 45", "Net 60", "Net 90", "COD"] },
    { key: "creditLimit", label: "Credit limit (SGD)", type: "number", required: true, sensitive: true, sapField: "CreditLimit" },
    { key: "currency", label: "Currency", type: "select", required: false, options: ["SGD", "MYR", "THB", "VND", "MMK", "USD"] },
    { key: "bankName", label: "Bank name", type: "text", required: false, sensitive: true },
    { key: "bankAccountNo", label: "Bank account no.", type: "text", required: false, sensitive: true, sapField: "BPBankAccounts.AccountNo" },
    { key: "swift", label: "SWIFT / BIC", type: "text", required: false, sensitive: true, pattern: "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$", patternHint: "8 or 11 characters, e.g. DBSSSGSG" },
  ],
  stages: [
    {
      id: "commercial",
      label: "Commercial & address checks",
      mode: "parallel",
      steps: [
        { id: "bu_head", label: "BU Head — commercial", role: "bu_head" },
        { id: "business_support", label: "Business Support — address & tax ID", role: "business_support" },
      ],
    },
    {
      id: "finance",
      label: "Credit terms",
      mode: "sequential",
      steps: [
        { id: "finance", label: "Finance — credit terms", role: "finance" },
        {
          id: "finance_director",
          label: "Finance Director — credit limit above S$50k",
          role: "finance_director",
          condition: { field: "creditLimit", op: "gt", value: 50000 },
        },
      ],
    },
  ],
};

export const VENDOR: DomainConfig = {
  id: "vendor",
  label: "New Vendor",
  description: "Create a new vendor business partner",
  icon: "Truck",
  sapObject: "oBusinessPartners",
  codePrefix: "V",
  dupCheck: true,
  enabled: true,
  fields: [
    { key: "vendorName", label: "Vendor name", type: "text", required: true, maxLength: 100, sapField: "CardName" },
    { key: "country", label: "Country", type: "country", required: true },
    { key: "taxId", label: "Tax ID", type: "text", required: true, sapField: "FederalTaxID" },
    { key: "street", label: "Street", type: "text", required: true },
    { key: "zipCode", label: "Postcode", type: "text", required: false },
    { key: "phone", label: "Phone", type: "phone", required: false },
    { key: "email", label: "Email", type: "email", required: true },
    { key: "suppliesRegulated", label: "Supplies regulated products?", type: "select", required: true, options: ["Yes", "No"] },
    { key: "bankName", label: "Bank name", type: "text", required: true, sensitive: true },
    { key: "bankAccountNo", label: "Bank account no.", type: "text", required: true, sensitive: true },
    { key: "swift", label: "SWIFT / BIC", type: "text", required: true, sensitive: true },
    { key: "paymentTerms", label: "Payment terms", type: "select", required: true, sensitive: true, options: ["Net 30", "Net 45", "Net 60"] },
  ],
  stages: [
    {
      id: "vendor-review",
      label: "Procurement & regulatory",
      mode: "parallel",
      steps: [
        { id: "procurement", label: "Procurement Head", role: "procurement" },
        {
          id: "qa_ra",
          label: "QA/RA — regulated supplier",
          role: "qa_ra",
          condition: { field: "suppliesRegulated", op: "equals", value: "Yes" },
        },
      ],
    },
    { id: "vendor-finance", label: "Bank details", mode: "sequential", steps: [{ id: "finance", label: "Finance — bank call-back", role: "finance" }] },
  ],
};

export const COSTCENTRE: DomainConfig = {
  id: "costcentre",
  label: "New Cost Centre",
  description: "Create a profit centre",
  icon: "Landmark",
  sapObject: "oProfitCenter",
  codePrefix: "CC",
  dupCheck: false,
  enabled: true,
  fields: [
    { key: "centreCode", label: "Centre code", type: "text", required: false, maxLength: 8, sapField: "CenterCode" },
    { key: "centreName", label: "Centre name", type: "text", required: true, maxLength: 30, sapField: "CenterName" },
    { key: "entity", label: "Entity", type: "entity", required: true },
    { key: "country", label: "Country", type: "country", required: true },
    { key: "owner", label: "Budget owner", type: "text", required: true },
    { key: "dimension", label: "Dimension", type: "select", required: true, options: ["1 · Country", "2 · Business unit", "3 · Department"] },
  ],
  stages: [
    {
      id: "cc-review",
      label: "Finance & BU",
      mode: "parallel",
      steps: [
        { id: "financial_controller", label: "Financial Controller", role: "financial_controller" },
        { id: "bu_head", label: "BU Head", role: "bu_head" },
      ],
    },
  ],
};

export const EXTEND: DomainConfig = {
  id: "extend",
  label: "Extend Existing Record",
  description: "Extend a customer to a new entity or ship-to",
  icon: "GitBranchPlus",
  sapObject: "oBusinessPartners",
  codePrefix: "C",
  dupCheck: false,
  enabled: true,
  fields: [
    { key: "existingCode", label: "Existing SAP code", type: "text", required: true },
    { key: "existingName", label: "Existing name", type: "text", required: true },
    { key: "extendToEntity", label: "Extend to entity", type: "entity", required: true },
    { key: "newShipToAddress", label: "New ship-to address", type: "textarea", required: false },
    { key: "changesCreditTerms", label: "Changes credit terms?", type: "select", required: true, options: ["Yes", "No"] },
    { key: "reason", label: "Reason", type: "textarea", required: true },
  ],
  stages: [
    {
      id: "extend-review",
      label: "Business Support",
      mode: "sequential",
      steps: [
        { id: "business_support", label: "Business Support", role: "business_support" },
        {
          id: "finance",
          label: "Finance — credit terms change",
          role: "finance",
          condition: { field: "changesCreditTerms", op: "equals", value: "Yes" },
        },
      ],
    },
  ],
};

export function master(p: Partial<CustomerMaster> & Pick<CustomerMaster, "cardCode" | "cardName">): CustomerMaster {
  return {
    entity: "SPD",
    country: "SG",
    goldenId: `G-${p.cardCode}`,
    segment: "Public hospital",
    hasTransactions: true,
    ...p,
  };
}

export const NUH = master({
  cardCode: "C-SG-00017",
  cardName: "National University Hospital",
  licTradNum: "198500123K",
  street: "5 Lower Kent Ridge Road",
  zipCode: "119074",
  phone1: "+65 6779 5555",
  hasTransactions: false,
});

export const MASTERS: CustomerMaster[] = [
  NUH,
  master({ cardCode: "C-SG-00021", cardName: "Mount Elizabeth Hospital", segment: "Private hospital", zipCode: "228510" }),
  master({ cardCode: "C-SG-00034", cardName: "Changi General Hospital", zipCode: "529889" }),
  master({ cardCode: "C-SG-00040", cardName: "National Heart Centre Singapore", zipCode: "169609" }),
  master({ cardCode: "C-SG-00052", cardName: "Raffles Medical Clinic", segment: "Clinic" }),
  master({ cardCode: "C-SG-00063", cardName: "Quest Laboratories Pte Ltd", segment: "Diagnostic lab" }),
  master({ cardCode: "C-MY-00011", cardName: "Sunway Medical Centre Sdn Bhd", country: "MY", segment: "Private hospital" }),
  master({ cardCode: "C-MY-00019", cardName: "Hospital Pulau Pinang", country: "MY" }),
  master({ cardCode: "C-TH-00008", cardName: "Bangkok Central Laboratory Co., Ltd.", country: "TH", segment: "Diagnostic lab" }),
];

export const AMY_EMAIL =
  "Hi MDM team, pls create item code for new dengue kit. Item: Dengue NS1 Ag Rapid Test 25T. Manufacturer: Biosens Diagnostics (KR). Category: IVD reagent. Pack: 25 tests/box, UoM BOX. Cost price SGD 182.00/box, selling SGD 265.00. Storage 2-30C. Entity SPD, for MY + SG customers. Need ASAP, Sunway has PR waiting. Thanks, Amy";
