# SAP Business One hand-off

OneRecord never writes to the SAP B1 database. An approved, MDM-checked request leaves OneRecord in one of two documented ways:

| Phase | Mechanism | Who presses the button | Licensing |
|---|---|---|---|
| **Phase 1 (go-live)** | OneRecord generates **Data Transfer Workbench (DTW)** CSV files with SAP's own technical field names. The MDM analyst simulates and imports them in DTW, then marks the request "Created in SAP B1". | MDM analyst (2–3 trained people) | None beyond existing B1 and M365 licences |
| **Phase 2 (with an SAP partner)** | A Process-licensed Power Automate flow posts the same data to the **Service Layer** REST API (`/b1s/v2`). | Nobody: it runs on MDM approval | 1 × Power Automate Process licence (see `../power-automate/flow-spec.md` §5) |

Both phases use the same field map. Each form field in the OneRecord config carries a `sapField` (e.g. `CardName`, `BPBankAccounts.AccountNo`), so the DTW column, the Service Layer property and the form field are the same name. Moving from Phase 1 to Phase 2 changes the transport, not the data.

The prototype's `/sap` screen simulates both: the DTW wizard (generate → simulate → import) and the Service Layer payload, which is badged Phase 2.

---

## Phase 1: DTW templates (`dtw-templates/`)

| File | DTW object | Parent / child | Used for |
|---|---|---|---|
| `oBusinessPartners.csv` | Business Partners (OCRD) | Parent, key `RecordKey` | New customer, new vendor |
| `BPAddresses.csv` | BP addresses (CRD1) | Child, `ParentKey` → `RecordKey` | Bill-to and ship-to; "Extend existing record" |
| `BPBankAccounts.csv` | BP bank accounts (OCRB) | Child, `ParentKey` → `RecordKey` | New vendor |
| `oItems.csv` | Items (OITM) | Parent | New item |
| *(generated only)* `Items_Prices.csv` | Item prices (ITM1) | Child, `ParentKey` → `RecordKey` | Sales and purchase price lists, when the request gives prices |
| `oProfitCenter.csv` | Profit centres (OPRC) | Parent | New cost centre |

Each template has the two DTW header rows:

1. **Row 1:** the DI API / Service Layer property names (`CardCode`, `FederalTaxID`, `EmailAddress` …). DTW maps on this row.
2. **Row 2:** the database column names (`CardCode`, `LicTradNum`, `E_Mail` …). DTW ignores this row on import; it is there for people.

Data rows start at row 3. Files are UTF-8, comma-separated, CRLF line endings, RFC 4180 quoting. OneRecord's `dtwToCsv` produces exactly this format.

`U_OneRecordRef` is a user-defined field (created once in B1 on OCRD, OITM and OPRC). It carries the OneRecord request ID, so every B1 record links back to its approval trail. Items also carry `U_Category`, `U_Manufacturer`, `U_PackSize`, `U_StorageCond` and `U_RegLicenceNo` (the HSA / MDA licence that IVD reagents and medical devices require). Profit centres carry `U_Entity`, `U_Country` and `U_Owner`. DTW expects UDFs at the end of the template under their technical names.

### Loading the files (MDM analyst)

1. In DTW, **Import → Business Object** → choose the object (e.g. *Business Partners*).
2. Select the parent file and any child files (`BPAddresses.csv`, `BPBankAccounts.csv`). DTW links them by `RecordKey` / `ParentKey`.
3. Choose **Add new objects**. Leave **Create Related Objects** off: it silently creates missing groups and currencies, which is exactly the kind of drift MDM exists to stop.
4. Run **Simulate** first. Fix any error in OneRecord (not in the CSV), regenerate, and simulate again until it reports 0 errors.
5. Run **Import**. Note the key DTW reports (e.g. `I-A-000813`) and confirm "Created in SAP B1" in OneRecord. That notifies the requestor and releases the blocked purchase requests.

The column lists come from the DTW object model and community-documented templates. Before go-live, diff them against the `Templates` folder of the installed DTW version (`C:\Program Files\SAP\Data Transfer Workbench\Templates\Templates\`).

---

## Phase 2: Service Layer (`service-layer-samples.json`)

The samples file holds the complete call sequence, with request bodies built from the same demo records:

1. `POST /b1s/v2/Login`: returns `SessionId`, `SessionTimeout: 30` and the `B1SESSION` and `ROUTEID` cookies.
2. `POST /b1s/v2/Items`, `/BusinessPartners` or `/ProfitCenters`: one call per new record.
3. `PATCH /b1s/v2/BusinessPartners('C-SG-00017')`: "Extend existing record" (adds an address; existing ones are kept).
4. `POST /b1s/v2/$batch`: a business partner and its child rows in one changeset that commits or rolls back as a whole.
5. `POST /b1s/v2/Logout`: returns `204 No Content`.

Operational notes:

- `/b1s/v1` is OData v3 and `/b1s/v2` is OData v4. OneRecord uses v2. Port 50000 is the HTTPS default in SAP's examples.
- The idle session timeout defaults to **30 minutes** (configurable in `b1s.conf`). Log in per flow run; don't cache sessions.
- Use **one dedicated integration user** with credentials in Azure Key Vault. B1 records that user as the creator, so the approving M365 user and request ID go into `U_OneRecordRef`.
- Default page size for GET is 20 (`Prefer: odata.maxpagesize` changes it). This matters only for duplicate look-ups, not for creation.
- From **FP 2602**, Service Layer webhooks (`BusinessPartners` Created/Updated/Deleted) can tell OneRecord when someone creates a record outside the workflow. They are off by default.
- Service Layer runs on Microsoft SQL Server (since 10.0 PL01) as well as HANA, so the design does not depend on which database Lives Group runs. Assumption: B1 10.0 FP 2405 or later.

---

## Field lengths and validation (SAP B1 10.0)

OneRecord enforces these limits on the request form (via `maxLength` in the domain config). The `/sap` simulator checks the generated files against the same limits before import (for `ItemCode` it uses the 50-character database limit). Where sources disagree, the form uses the stricter value.

| Object | Property (DTW / Service Layer) | DB column | Max length | Notes |
|---|---|---|---|---|
| Business partner | `CardCode` | `CardCode` | 15 | The key; the only property the SDK marks mandatory. `C-SG-00123` is 10 |
| | `CardName` | `CardName` | **100** on the form | The 2026 Web client import spec says 200; the SDK page says 100 |
| | `CardType` | `CardType` | 1 | `C` customer, `S` vendor, `L` lead (`cCustomer` / `cSupplier` / `cLid` in the API) |
| | `FederalTaxID` | `LicTradNum` | 32 | **No unique index in B1**: two partners can share a tax ID without warning. OneRecord's duplicate check closes this gap |
| | `Currency` | `Currency` | 3 | Must already exist in B1 (OCRN) |
| | `EmailAddress` | `E_Mail` | 100 | |
| | `Phone1` | `Phone1` | **20** on the form | Some references give 50 |
| | `PayTermsGrpCode` | `GroupNum` | FK | Payment terms; sensitive (Finance and MDM only) |
| | `CreditLimit` | `CreditLine` | number | Sensitive |
| Item | `ItemCode` | `ItemCode` | **20** on the form | The SDK says 20; newer databases allow 50. `I-A-000813` is 10 |
| | `ItemName` | `ItemName` | **100** on the form | SDK 10.0 says 200 |
| | `InventoryUOM`, `PurchaseUnit`, `SalesUnit` | `InvntryUom`, `BuyUnitMsr`, `SalUnitMsr` | 5 | Unit codes such as `BOX` |
| | `Mainsupplier` | `CardCode` | 15 | Must be an existing vendor code |
| Profit centre | `CenterCode` | `PrcCode` | **8** | See the note below |
| | `CenterName` | `PrcName` | 30 | |
| | `InWhichDimension` | `DimCode` | 1–5 | Up to 5 dimensions once multidimensions are enabled |

**Cost-centre code length.** `OPRC.PrcCode` allows 8 characters. A display code such as `CC-SG-0031` (10 characters) does not fit, so the B1 code drops the `CC-` prefix: `SG-0031` (country + 4 digits), as in `service-layer-samples.json`. The `/sap` simulator checks every key against its SAP limit and reports an over-length value as an error, as DTW would.

**Duplicates.** B1 does not stop duplicate business partners on its own. OneRecord's duplicate check (normalised name, tax ID, postcode, phone and email domain) runs at request time, before anything reaches B1. That is why it sits at the front of the workflow, not in the integration.
