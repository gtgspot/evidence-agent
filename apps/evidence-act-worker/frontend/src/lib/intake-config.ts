import { ADMISSIBILITY_STATUSES, CORE_STATUTORY_GATES } from "@/lib/statutes";

export const TENDER_PURPOSE_VALUES = [
  "truth",
  "credibility",
  "context",
  "state_of_investigation",
  "admissibility",
  "non_hearsay",
  "proof",
] as const;

export type TenderPurpose = (typeof TENDER_PURPOSE_VALUES)[number];
export type CoreRule = (typeof CORE_STATUTORY_GATES)[number];
export type AdmissibilityStatus = (typeof ADMISSIBILITY_STATUSES)[number];
export type StorageMode = "local_path" | "r2_uri";
export type EvidenceItemType =
  | "body_worn_camera"
  | "dashcam"
  | "certificate"
  | "electronic_communication"
  | "official_record";

export interface TenderPurposeOption {
  value: TenderPurpose;
  label: string;
  description: string;
  requiredRules: CoreRule[];
  suggestedStatuses: AdmissibilityStatus[];
  defaultNextAction: string;
}

export interface EvidenceItemTypeOption {
  value: EvidenceItemType;
  label: string;
  description: string;
  defaultLocalSourcePath: string;
  defaultPurpose: TenderPurpose;
  allowedPurposes: TenderPurpose[];
  defaultFact: string;
  recommendedRules: CoreRule[];
  recommendedDefects: string[];
}

export interface FactInIssueOption {
  value: string;
  label: string;
  description: string;
  applicableItemTypes: EvidenceItemType[];
  suggestedRules: CoreRule[];
}

export interface DefectOption {
  value: string;
  label: string;
  description: string;
}

export interface StatusOption {
  value: AdmissibilityStatus;
  label: string;
  description: string;
  applicablePurposes: TenderPurpose[] | "all";
  requiredRules: CoreRule[];
  suggestedDefects: string[];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

export const TENDER_PURPOSE_OPTIONS: TenderPurposeOption[] = [
  {
    value: "truth",
    label: "Truth",
    description: "Use only when tendered to prove asserted facts as true.",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence", "s 59 hearsay"],
    suggestedStatuses: ["conditionally admissible", "requires foundation", "contested"],
    defaultNextAction: "Identify representation maker, hearsay pathway, and foundation witness.",
  },
  {
    value: "credibility",
    label: "Credibility",
    description: "Use to challenge or support reliability of witness or officer evidence.",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedStatuses: ["limited purpose only", "contested", "requires leave"],
    defaultNextAction: "State credibility issue and identify contradiction or reliability basis.",
  },
  {
    value: "context",
    label: "Context",
    description: "Use to explain sequence, continuity, or investigative context only.",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedStatuses: ["limited purpose only", "contested"],
    defaultNextAction: "Constrain tender use to context and avoid truth purpose drift.",
  },
  {
    value: "state_of_investigation",
    label: "State Of Investigation",
    description: "Use to show investigative pathway, not truth of representations.",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence", "s 59 hearsay"],
    suggestedStatuses: ["limited purpose only", "contested"],
    defaultNextAction: "Articulate non-hearsay purpose and identify decision pathway impact.",
  },
  {
    value: "admissibility",
    label: "Admissibility",
    description: "Use where evidence is tendered to establish or contest a legal admissibility point.",
    requiredRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 135 discretionary exclusion",
      "s 137 mandatory exclusion of prejudicial prosecution evidence",
      "s 138 improperly or illegally obtained evidence",
      "s 189 preliminary questions / voir dire",
    ],
    suggestedStatuses: ["potential s 138 issue", "potential s 137 issue", "potential s 135 issue", "requires leave"],
    defaultNextAction: "Separate source of power, alleged impropriety, and exclusion balancing factors.",
  },
  {
    value: "non_hearsay",
    label: "Non-Hearsay",
    description: "Use where representation is tendered for a purpose other than proving truth.",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence", "s 59 hearsay"],
    suggestedStatuses: ["limited purpose only", "conditionally admissible", "contested"],
    defaultNextAction: "State exact non-hearsay purpose and judicial direction requested.",
  },
  {
    value: "proof",
    label: "Proof",
    description: "Use to establish formal proof pathway, authentication, service, or continuity.",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedStatuses: ["requires foundation", "conditionally admissible", "requires notice"],
    defaultNextAction: "Identify certificate, witness, and metadata required for proof pathway.",
  },
];

export const EVIDENCE_ITEM_TYPES: EvidenceItemTypeOption[] = [
  {
    value: "body_worn_camera",
    label: "Body Worn Camera",
    description: "Officer-worn recording requiring timing, operator, and continuity checks.",
    defaultLocalSourcePath: "source_vault/bwc/clip-01.mp4",
    defaultPurpose: "credibility",
    allowedPurposes: ["credibility", "context", "state_of_investigation", "admissibility", "truth", "non_hearsay"],
    defaultFact: "whether the accused was authorised to drive",
    recommendedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 138 improperly or illegally obtained evidence",
      "s 189 preliminary questions / voir dire",
    ],
    recommendedDefects: ["missing foundation witness", "missing continuity metadata"],
  },
  {
    value: "dashcam",
    label: "Dashcam",
    description: "Vehicle-mounted recording requiring chronology and activation integrity checks.",
    defaultLocalSourcePath: "source_vault/dashcam/intercept-01.mp4",
    defaultPurpose: "context",
    allowedPurposes: ["context", "credibility", "state_of_investigation", "admissibility", "truth", "non_hearsay"],
    defaultFact: "whether oral fluid sample process complied with statutory preconditions",
    recommendedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 138 improperly or illegally obtained evidence",
    ],
    recommendedDefects: ["missing continuity metadata", "possible unlawfully obtained evidence"],
  },
  {
    value: "certificate",
    label: "Certificate",
    description: "Statutory or expert certificate requiring particulars and signatory checks.",
    defaultLocalSourcePath: "source_vault/certificates/certificate-01.pdf",
    defaultPurpose: "proof",
    allowedPurposes: ["proof", "truth", "admissibility", "non_hearsay"],
    defaultFact: "whether certificate particulars are compliant",
    recommendedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 137 mandatory exclusion of prejudicial prosecution evidence",
      "s 189 preliminary questions / voir dire",
    ],
    recommendedDefects: ["missing statutory certificate", "missing foundation witness"],
  },
  {
    value: "electronic_communication",
    label: "Electronic Communication",
    description: "Email/SMS correspondence requiring maker, context, and purpose precision.",
    defaultLocalSourcePath: "source_vault/correspondence/email-01.eml",
    defaultPurpose: "non_hearsay",
    allowedPurposes: ["non_hearsay", "truth", "context", "credibility", "admissibility"],
    defaultFact: "whether chain of custody is continuous",
    recommendedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 59 hearsay",
      "s 135 discretionary exclusion",
    ],
    recommendedDefects: ["purpose of tender unclear", "missing foundation witness"],
  },
  {
    value: "official_record",
    label: "Official Record",
    description: "Institutional record requiring provenance, continuity, and service checks.",
    defaultLocalSourcePath: "source_vault/leap/record-01.pdf",
    defaultPurpose: "proof",
    allowedPurposes: ["proof", "truth", "context", "admissibility", "state_of_investigation"],
    defaultFact: "whether chain of custody is continuous",
    recommendedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 135 discretionary exclusion",
      "s 137 mandatory exclusion of prejudicial prosecution evidence",
    ],
    recommendedDefects: ["chain-of-custody gap", "missing continuity metadata"],
  },
];

export const FACT_IN_ISSUE_OPTIONS: FactInIssueOption[] = [
  {
    value: "whether the accused was authorised to drive",
    label: "Authority To Drive",
    description: "Licensing/authorisation status at the time of driving.",
    applicableItemTypes: ["body_worn_camera", "dashcam", "electronic_communication", "official_record"],
    suggestedRules: ["s 55 relevance", "s 56 admissibility of relevant evidence", "s 59 hearsay"],
  },
  {
    value: "whether oral fluid sample process complied with statutory preconditions",
    label: "Oral Fluid Preconditions",
    description: "Whether statutory sequence and preconditions were followed before sample demand.",
    applicableItemTypes: ["body_worn_camera", "dashcam", "official_record"],
    suggestedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 138 improperly or illegally obtained evidence",
      "s 189 preliminary questions / voir dire",
    ],
  },
  {
    value: "whether chain of custody is continuous",
    label: "Chain Of Custody",
    description: "Continuity and integrity of evidence transfer from collection to analysis.",
    applicableItemTypes: ["body_worn_camera", "dashcam", "certificate", "electronic_communication", "official_record"],
    suggestedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 135 discretionary exclusion",
      "s 137 mandatory exclusion of prejudicial prosecution evidence",
    ],
  },
  {
    value: "whether certificate particulars are compliant",
    label: "Certificate Particulars",
    description: "Compliance with required statutory particulars and formal proof requirements.",
    applicableItemTypes: ["certificate", "official_record", "electronic_communication"],
    suggestedRules: [
      "s 55 relevance",
      "s 56 admissibility of relevant evidence",
      "s 137 mandatory exclusion of prejudicial prosecution evidence",
    ],
  },
  {
    value: "whether evidence should be excluded under s 135 / s 137 / s 138",
    label: "Exclusion Pathway",
    description: "Whether exclusionary discretions or mandatory exclusions should be applied.",
    applicableItemTypes: ["body_worn_camera", "dashcam", "certificate", "electronic_communication", "official_record"],
    suggestedRules: [
      "s 135 discretionary exclusion",
      "s 137 mandatory exclusion of prejudicial prosecution evidence",
      "s 138 improperly or illegally obtained evidence",
      "s 189 preliminary questions / voir dire",
    ],
  },
];

export const DEFECT_OPTIONS: DefectOption[] = [
  {
    value: "missing foundation witness",
    label: "Missing Foundation Witness",
    description: "No identified witness to prove authenticity, operation, or context.",
  },
  {
    value: "chain-of-custody gap",
    label: "Chain-Of-Custody Gap",
    description: "Continuity period has no admissible supporting record.",
  },
  {
    value: "missing statutory certificate",
    label: "Missing Statutory Certificate",
    description: "Prescribed certificate is absent or not in admissible form.",
  },
  {
    value: "purpose of tender unclear",
    label: "Purpose Of Tender Unclear",
    description: "Truth and non-hearsay purposes are not distinctly articulated.",
  },
  {
    value: "notice/leave not established",
    label: "Notice/Leave Not Established",
    description: "Required notice or leave pathway has not been shown.",
  },
  {
    value: "possible unlawfully obtained evidence",
    label: "Possible Unlawfully Obtained Evidence",
    description: "Potential impropriety or illegality may trigger exclusion analysis.",
  },
  {
    value: "missing continuity metadata",
    label: "Missing Continuity Metadata",
    description: "Timestamp, device, or transfer metadata is incomplete.",
  },
  {
    value: "unresolved source-of-power pathway",
    label: "Unresolved Source-Of-Power Pathway",
    description: "Source of authority for obtaining evidence is not resolved.",
  },
];

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "admissible on current material",
    label: "Admissible On Current Material",
    description: "Use only when current material satisfies all identified gates and foundations.",
    applicablePurposes: ["truth", "proof", "non_hearsay"],
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: [],
  },
  {
    value: "conditionally admissible",
    label: "Conditionally Admissible",
    description: "Admissibility depends on further foundational or contextual evidence.",
    applicablePurposes: "all",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: ["missing foundation witness"],
  },
  {
    value: "limited purpose only",
    label: "Limited Purpose Only",
    description: "Evidence may be used only for constrained non-truth or credibility purposes.",
    applicablePurposes: ["credibility", "context", "state_of_investigation", "non_hearsay"],
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: ["purpose of tender unclear"],
  },
  {
    value: "contested",
    label: "Contested",
    description: "Admissibility remains in dispute pending argument or factual clarification.",
    applicablePurposes: "all",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: [],
  },
  {
    value: "requires foundation",
    label: "Requires Foundation",
    description: "Foundational proof is insufficient for current use.",
    applicablePurposes: "all",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: ["missing foundation witness"],
  },
  {
    value: "requires notice",
    label: "Requires Notice",
    description: "Formal notice obligations are not complete.",
    applicablePurposes: ["proof", "truth", "admissibility"],
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: ["notice/leave not established"],
  },
  {
    value: "requires leave",
    label: "Requires Leave",
    description: "Judicial leave is required before tender can proceed.",
    applicablePurposes: ["credibility", "admissibility", "truth"],
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence", "s 189 preliminary questions / voir dire"],
    suggestedDefects: ["notice/leave not established"],
  },
  {
    value: "potential s 135 issue",
    label: "Potential s 135 Issue",
    description: "Potential discretionary exclusion due to unfair prejudice, confusion, or delay.",
    applicablePurposes: ["admissibility", "truth", "proof"],
    requiredRules: ["s 135 discretionary exclusion"],
    suggestedDefects: ["purpose of tender unclear"],
  },
  {
    value: "potential s 137 issue",
    label: "Potential s 137 Issue",
    description: "Potential mandatory exclusion of prosecution evidence with unfair prejudice.",
    applicablePurposes: ["admissibility", "truth", "proof"],
    requiredRules: ["s 137 mandatory exclusion of prejudicial prosecution evidence"],
    suggestedDefects: ["purpose of tender unclear"],
  },
  {
    value: "potential s 138 issue",
    label: "Potential s 138 Issue",
    description: "Potential exclusion of improperly or illegally obtained evidence.",
    applicablePurposes: ["admissibility", "context", "state_of_investigation"],
    requiredRules: ["s 138 improperly or illegally obtained evidence", "s 189 preliminary questions / voir dire"],
    suggestedDefects: ["possible unlawfully obtained evidence", "unresolved source-of-power pathway"],
  },
  {
    value: "inadmissible on current material",
    label: "Inadmissible On Current Material",
    description: "Current material does not satisfy admissibility requirements.",
    applicablePurposes: "all",
    requiredRules: ["s 55 relevance", "s 56 admissibility of relevant evidence"],
    suggestedDefects: ["missing foundation witness", "purpose of tender unclear"],
  },
];

const PURPOSE_LOOKUP = new Map(TENDER_PURPOSE_OPTIONS.map((option) => [option.value, option]));
const ITEM_LOOKUP = new Map(EVIDENCE_ITEM_TYPES.map((option) => [option.value, option]));
const FACT_LOOKUP = new Map(FACT_IN_ISSUE_OPTIONS.map((option) => [option.value, option]));
const STATUS_LOOKUP = new Map(STATUS_OPTIONS.map((option) => [option.value, option]));

export function getItemTypeConfig(value: string): EvidenceItemTypeOption {
  return ITEM_LOOKUP.get(value as EvidenceItemType) ?? EVIDENCE_ITEM_TYPES[0];
}

export function getPurposeConfig(value: string): TenderPurposeOption {
  return PURPOSE_LOOKUP.get(value as TenderPurpose) ?? TENDER_PURPOSE_OPTIONS[0];
}

export function getFactConfig(value: string): FactInIssueOption {
  return FACT_LOOKUP.get(value) ?? FACT_IN_ISSUE_OPTIONS[0];
}

export function getStatusConfig(value: string): StatusOption {
  return STATUS_LOOKUP.get(value as AdmissibilityStatus) ?? STATUS_OPTIONS[0];
}

export function getAllowedPurposesForItemType(itemType: string): TenderPurposeOption[] {
  const config = getItemTypeConfig(itemType);
  return TENDER_PURPOSE_OPTIONS.filter((option) => config.allowedPurposes.includes(option.value));
}

export function getAllowedFactsForItemType(itemType: string): FactInIssueOption[] {
  const typed = itemType as EvidenceItemType;
  return FACT_IN_ISSUE_OPTIONS.filter((option) => option.applicableItemTypes.includes(typed));
}

export function getAllowedStatusesForPurpose(purpose: string): StatusOption[] {
  const typed = purpose as TenderPurpose;
  return STATUS_OPTIONS.filter(
    (status) => status.applicablePurposes === "all" || status.applicablePurposes.includes(typed),
  );
}

export function getRequiredRulesForPurpose(purpose: string): CoreRule[] {
  return getPurposeConfig(purpose).requiredRules;
}

export function getSuggestedRules(itemType: string, purpose: string, factInIssue: string): CoreRule[] {
  const typeRules = getItemTypeConfig(itemType).recommendedRules;
  const purposeRules = getPurposeConfig(purpose).requiredRules;
  const factRules = getFactConfig(factInIssue).suggestedRules;
  return unique([...typeRules, ...purposeRules, ...factRules]);
}

export function getSuggestedDefects(itemType: string, purpose: string, status: string): string[] {
  const typeDefects = getItemTypeConfig(itemType).recommendedDefects;
  const statusDefects = getStatusConfig(status).suggestedDefects;
  const purposeDefects = getPurposeConfig(purpose).value === "admissibility" ? ["unresolved source-of-power pathway"] : [];
  return unique([...typeDefects, ...statusDefects, ...purposeDefects]);
}

export function getDefaultStatusForPurpose(purpose: string): AdmissibilityStatus {
  const option = getPurposeConfig(purpose);
  return option.suggestedStatuses[0] ?? ADMISSIBILITY_STATUSES[0];
}

export function getDefaultNextAction(itemType: string, purpose: string, status: string): string {
  const fromPurpose = getPurposeConfig(purpose).defaultNextAction;
  const fromStatus = getStatusConfig(status).description;
  const fromType = getItemTypeConfig(itemType).description;
  return `${fromPurpose} (${fromStatus} | ${fromType})`;
}

export function normalizeStatus(status: string, purpose: string): AdmissibilityStatus {
  const allowed = getAllowedStatusesForPurpose(purpose);
  const exact = allowed.find((option) => option.value === status);
  if (exact) return exact.value;
  return getDefaultStatusForPurpose(purpose);
}

