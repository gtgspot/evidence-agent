import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileDown,
  FileText,
  Gavel,
  KeyRound,
  Search,
  Scale,
  UploadCloud,
} from "lucide-react";
import { ADMISSIBILITY_STATUSES, CORE_STATUTORY_GATES } from "@/lib/statutes";
import {
  DEFECT_OPTIONS,
  EVIDENCE_ITEM_TYPES,
  FACT_IN_ISSUE_OPTIONS,
  TENDER_PURPOSE_OPTIONS,
  getAllowedFactsForItemType,
  getAllowedPurposesForItemType,
  getAllowedStatusesForPurpose,
  getDefaultNextAction,
  getDefaultStatusForPurpose,
  getItemTypeConfig,
  getPurposeConfig,
  getRequiredRulesForPurpose,
  getStatusConfig,
  getSuggestedDefects,
  getSuggestedRules,
  normalizeStatus,
  type AdmissibilityStatus,
  type StorageMode,
  type TenderPurpose,
} from "@/lib/intake-config";
import type { AdmissibilityReport, DashboardEvidenceItem, EvidenceRegisterRow } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const BUILD_ORDER = [
  "Static UI shell",
  "Evidence Register table",
  "Add Evidence Item form",
  "Facts in Issue module",
  "Statutory Rule library",
  "Evidence-to-fact mapping",
  "Evidence-to-section mapping",
  "Admissibility validator",
  "Defect tracker",
  "Timeline",
  "Exhibit register",
  "Export to Markdown / PDF bundle",
  "Cloudflare D1 persistence",
  "R2 file storage",
  "Authentication",
];

const GATE_CARD_ORDER = [
  "relevance",
  "hearsay",
  "opinion",
  "admissions",
  "credibility",
  "exclusion",
  "proof",
] as const;

const GATE_LABELS: Record<string, string> = {
  relevance: "Relevance",
  hearsay: "Hearsay",
  opinion: "Opinion",
  admissions: "Admissions",
  credibility: "Credibility",
  exclusion: "Exclusion",
  proof: "Proof",
};

const WORKFLOW_SECTIONS = [
  { id: "evidence-intake", label: "1. Evidence Intake" },
  { id: "evidence-register", label: "2. Evidence Register" },
  { id: "assessment-result", label: "3. Assessment Result" },
  { id: "reference-panels", label: "4. Reference Panels" },
  { id: "ledger-section", label: "5. Ledger and Extensions" },
] as const;

interface FormState {
  title: string;
  timestamp: string;
  itemType: string;
  tenderPurpose: TenderPurpose;
  factAsserted: string;
  linkedFactInIssue: string;
  admissibilityStatus: AdmissibilityStatus;
  nextAction: string;
  tenderingParty: string;
  notes: string;
  linkedChargeId: string;
  matterId: string;
  storageMode: StorageMode;
  localSourcePath: string;
  r2Bucket: string;
  r2Key: string;
}

interface LedgerEntry {
  id: string;
  event_type: string;
  created_at: string;
  matter_id?: string;
}

interface AuthStatus {
  auth_required: boolean;
  r2_bound: boolean;
}

interface ApiHealthPayload {
  ok: boolean;
  app: string;
  environment: string;
  instrument: string;
  version: string;
  version_date: string;
  bindings?: {
    r2_bound: boolean;
    ai_bound: boolean;
    vectorize_bound: boolean;
    vector_namespace: string;
    vector_embed_model: string;
  };
  d1: {
    bound: boolean;
    ok: boolean;
    error?: string;
  };
  metrics: {
    matters: number;
    evidence_items: number;
    admissibility_reports: number;
    ledger_entries: number;
    last_ledger_entry_at: string | null;
  };
}

interface ContextFileApiPayload {
  ok: boolean;
  exists?: boolean;
  file?: {
    id: string;
    name: string;
    content_text: string;
    source_path: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
}

interface UiError {
  id: string;
  message: string;
}

interface LineCheck {
  line: string;
  status: "ok" | "warning" | "error";
  detail: string;
}

const DEFAULT_TYPE = EVIDENCE_ITEM_TYPES[0];

const INITIAL_FORM: FormState = {
  title: "",
  timestamp: new Date().toISOString().slice(0, 16),
  itemType: DEFAULT_TYPE.value,
  tenderPurpose: DEFAULT_TYPE.defaultPurpose,
  factAsserted: "",
  linkedFactInIssue: DEFAULT_TYPE.defaultFact,
  admissibilityStatus: getDefaultStatusForPurpose(DEFAULT_TYPE.defaultPurpose),
  nextAction: getDefaultNextAction(
    DEFAULT_TYPE.value,
    DEFAULT_TYPE.defaultPurpose,
    getDefaultStatusForPurpose(DEFAULT_TYPE.defaultPurpose),
  ),
  tenderingParty: "defence",
  notes: "",
  linkedChargeId: "C1",
  matterId: "R10165672",
  storageMode: "local_path",
  localSourcePath: DEFAULT_TYPE.defaultLocalSourcePath,
  r2Bucket: "evidence-act-files",
  r2Key: "matter/R10165672/evidence/",
};

function makeId(prefix: string): string {
  const tail = crypto.randomUUID().split("-")[0].toUpperCase();
  return `${prefix}-${tail}`;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const lower = status.toLowerCase();
  if (lower.includes("admissible") || lower.includes("foundation satisfied")) return "success";
  if (lower.includes("inadmissible") || lower.includes("exclusion risk") || lower.includes("potential s 137") || lower.includes("potential s 138")) {
    return "danger";
  }
  if (lower.includes("contestable") || lower.includes("requires") || lower.includes("needs proof")) return "warning";
  if (lower.includes("source found") || lower.includes("neutral")) return "info";
  if (lower.includes("not_assessed") || lower.includes("not assessed")) return "neutral";
  return "warning";
}

function sourceReference(form: FormState): string {
  if (form.storageMode === "r2_uri") {
    const key = form.r2Key.replace(/^\/+/, "");
    return `r2://${form.r2Bucket}/${key}`;
  }
  return form.localSourcePath;
}

function formatTimestampInput(value?: string): string {
  if (!value) return "";
  const normalized = value.replace("Z", "");
  return normalized.slice(0, 16);
}

function toApiTimestamp(value: string): string {
  if (!value.trim()) return new Date().toISOString();
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return value;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function checkVariant(status: LineCheck["status"]): "success" | "warning" | "danger" | "neutral" {
  if (status === "ok") return "success";
  if (status === "warning") return "warning";
  if (status === "error") return "danger";
  return "neutral";
}

function gateStatusVariant(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  if (status === "pass") return "success";
  if (status === "fail") return "danger";
  if (status === "contestable") return "warning";
  if (status === "not_assessed") return "neutral";
  return "info";
}

function requiredReportFieldsPresent(report: Partial<AdmissibilityReport>): boolean {
  return Boolean(
    report.classification &&
      Array.isArray(report.legal_effect) &&
      Array.isArray(report.gate_results) &&
      Array.isArray(report.missing_proof_global) &&
      typeof report.voir_dire_required === "boolean" &&
      typeof report.advance_ruling_candidate === "boolean" &&
      report.extension_report,
  );
}

function buildLineChecks(
  form: FormState,
  selectedRules: string[],
  selectedDefects: string[],
  r2Bound: boolean,
): { checks: LineCheck[]; blockingErrors: string[] } {
  const checks: LineCheck[] = [];
  const blockingErrors: string[] = [];

  const allowedPurposes = getAllowedPurposesForItemType(form.itemType).map((option) => option.value);
  const statusConfig = getStatusConfig(form.admissibilityStatus);
  const requiredPurposeRules = getRequiredRulesForPurpose(form.tenderPurpose);
  const requiredStatusRules = statusConfig.requiredRules;
  const requiredRules = uniqueStrings([...requiredPurposeRules, ...requiredStatusRules]);
  const missingRequiredRules = requiredRules.filter((rule) => !selectedRules.includes(rule));

  if (form.title.trim().length >= 8) {
    checks.push({ line: "1. Title", status: "ok", detail: "Title length is suitable for register triage." });
  } else {
    checks.push({ line: "1. Title", status: "error", detail: "Provide a specific title with at least 8 characters." });
    blockingErrors.push("Title must be at least 8 characters.");
  }

  if (form.timestamp.trim()) {
    checks.push({ line: "2. Timestamp", status: "ok", detail: "Timestamp is present." });
  } else {
    checks.push({ line: "2. Timestamp", status: "error", detail: "Timestamp is required." });
    blockingErrors.push("Timestamp is required.");
  }

  if (form.storageMode === "local_path") {
    if (form.localSourcePath.trim().length > 0) {
      checks.push({
        line: "3. Source Reference",
        status: "ok",
        detail: "Local source path is present.",
      });
    } else {
      checks.push({
        line: "3. Source Reference",
        status: "error",
        detail: "Source path is required for local path mode.",
      });
      blockingErrors.push("Source path is required in local mode.");
    }
  } else if (!form.r2Bucket.trim() || !form.r2Key.trim()) {
    checks.push({
      line: "3. Source Reference",
      status: "error",
      detail: "R2 bucket and key are required for R2 URI mode.",
    });
    blockingErrors.push("R2 bucket and key are required in R2 mode.");
  } else if (!r2Bound) {
    checks.push({
      line: "3. Source Reference",
      status: "warning",
      detail: "R2 binding is not active yet; URI reference will be stored without upload.",
    });
  } else {
    checks.push({
      line: "3. Source Reference",
      status: "ok",
      detail: "R2 bucket/key format is present.",
    });
  }

  if (allowedPurposes.includes(form.tenderPurpose)) {
    checks.push({
      line: "4. Item Type vs Purpose",
      status: "ok",
      detail: "Selected tender purpose is permitted for this item type.",
    });
  } else {
    checks.push({
      line: "4. Item Type vs Purpose",
      status: "error",
      detail: "Selected purpose is not configured for this item type.",
    });
    blockingErrors.push("Purpose is incompatible with item type.");
  }

  if (form.linkedFactInIssue.trim()) {
    checks.push({
      line: "5. Fact In Issue",
      status: "ok",
      detail: "Fact in issue is linked.",
    });
  } else {
    checks.push({
      line: "5. Fact In Issue",
      status: "error",
      detail: "A linked fact in issue is required.",
    });
    blockingErrors.push("Fact in issue is required.");
  }

  if (missingRequiredRules.length === 0 && selectedRules.length > 0) {
    checks.push({
      line: "6. Statutory Rules",
      status: "ok",
      detail: "Required rules for purpose and status are selected.",
    });
  } else {
    const reason =
      missingRequiredRules.length > 0
        ? `Missing required rules: ${missingRequiredRules.join(", ")}.`
        : "Select at least one linked statutory rule.";
    checks.push({ line: "6. Statutory Rules", status: "error", detail: reason });
    blockingErrors.push(reason);
  }

  const admissibleNow = form.admissibilityStatus === "admissible on current material";
  const statusDefectConflict = admissibleNow && selectedDefects.length > 0;
  const s138WithoutDefect =
    form.admissibilityStatus === "potential s 138 issue" && !selectedDefects.includes("possible unlawfully obtained evidence");

  if (statusDefectConflict) {
    checks.push({
      line: "7. Status vs Defects",
      status: "warning",
      detail: "Status says admissible now, but defects remain selected.",
    });
  } else if (s138WithoutDefect) {
    checks.push({
      line: "7. Status vs Defects",
      status: "warning",
      detail: "Potential s 138 issue selected without unlawful-obtaining defect marker.",
    });
  } else {
    checks.push({
      line: "7. Status vs Defects",
      status: "ok",
      detail: "Status and defect selections are coherent.",
    });
  }

  if (form.nextAction.trim().length >= 12) {
    checks.push({
      line: "8. Next Action",
      status: "ok",
      detail: "Next action has sufficient operational detail.",
    });
  } else {
    checks.push({
      line: "8. Next Action",
      status: "error",
      detail: "Next action should state a concrete step (12+ characters).",
    });
    blockingErrors.push("Next action must be specific.");
  }

  return { checks, blockingErrors };
}

export default function App(): JSX.Element {
  const [rows, setRows] = useState<EvidenceRegisterRow[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [evidenceQuery, setEvidenceQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRules, setSelectedRules] = useState<string[]>(
    getSuggestedRules(INITIAL_FORM.itemType, INITIAL_FORM.tenderPurpose, INITIAL_FORM.linkedFactInIssue),
  );
  const [selectedDefects, setSelectedDefects] = useState<string[]>(
    getSuggestedDefects(INITIAL_FORM.itemType, INITIAL_FORM.tenderPurpose, INITIAL_FORM.admissibilityStatus),
  );
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [authKeyInput, setAuthKeyInput] = useState("");
  const [authKey, setAuthKey] = useState(localStorage.getItem("evidence_dashboard_api_key") ?? "");
  const [authRequired, setAuthRequired] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [r2Bound, setR2Bound] = useState(false);
  const [health, setHealth] = useState<ApiHealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [uiErrors, setUiErrors] = useState<UiError[]>([]);
  const [contextFileName, setContextFileName] = useState("case_context.md");
  const [contextSourcePath, setContextSourcePath] = useState("file/context/case_context.md");
  const [contextContent, setContextContent] = useState("");
  const [contextUpdatedAt, setContextUpdatedAt] = useState<string | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextSaving, setContextSaving] = useState(false);
  const [contextMessage, setContextMessage] = useState("");

  const coreFlow = "Evidence item -> Fact in issue -> Statutory rule -> Defect -> Status -> Next action";
  const typeConfig = useMemo(() => getItemTypeConfig(form.itemType), [form.itemType]);
  const purposeConfig = useMemo(() => getPurposeConfig(form.tenderPurpose), [form.tenderPurpose]);
  const statusConfig = useMemo(() => getStatusConfig(form.admissibilityStatus), [form.admissibilityStatus]);
  const availablePurposes = useMemo(() => getAllowedPurposesForItemType(form.itemType), [form.itemType]);
  const availableFacts = useMemo(() => getAllowedFactsForItemType(form.itemType), [form.itemType]);
  const availableStatuses = useMemo(() => getAllowedStatusesForPurpose(form.tenderPurpose), [form.tenderPurpose]);
  const requiredPurposeRules = useMemo(() => getRequiredRulesForPurpose(form.tenderPurpose), [form.tenderPurpose]);
  const { checks: lineChecks, blockingErrors } = useMemo(
    () => buildLineChecks(form, selectedRules, selectedDefects, r2Bound),
    [form, r2Bound, selectedDefects, selectedRules],
  );
  const canSubmit = !submitting && blockingErrors.length === 0;

  function pushUiError(message: string): void {
    setUiErrors((prev) => {
      if (prev.some((entry) => entry.message === message)) return prev;
      return [{ id: crypto.randomUUID(), message }, ...prev].slice(0, 8);
    });
  }

  function clearUiError(message: string): void {
    setUiErrors((prev) => prev.filter((entry) => entry.message !== message));
  }

  function clearUiErrorByPrefix(prefix: string): void {
    setUiErrors((prev) => prev.filter((entry) => !entry.message.startsWith(prefix)));
  }

  useEffect(() => {
    void bootstrapAuth();
  }, []);

  useEffect(() => {
    void loadHealth();
  }, []);

  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    void Promise.all([loadEvidence(), loadLedger(), loadContextFile()]);
  }, [authReady, isAuthenticated]);

  async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = new Headers(init?.headers ?? {});
    if (authKey) {
      headers.set("authorization", `Bearer ${authKey}`);
    }

    const response = await fetch(path, { ...init, headers });
    if (response.status === 401) {
      setIsAuthenticated(false);
      setAuthError("Session rejected. Re-enter dashboard API key.");
    }
    if (response.status >= 500) {
      pushUiError(`API route returned ${response.status} for ${path}.`);
    }
    return response;
  }

  async function bootstrapAuth(): Promise<void> {
    const statusRes = await fetch("/api/auth/status");
    if (!statusRes.ok) {
      setAuthError(`Unable to read auth status (${statusRes.status}).`);
      setAuthReady(true);
      return;
    }

    const status = (await statusRes.json()) as AuthStatus;
    setAuthRequired(status.auth_required);
    setR2Bound(status.r2_bound);

    if (!status.auth_required) {
      setIsAuthenticated(true);
      setAuthReady(true);
      return;
    }

    if (!authKey) {
      setAuthReady(true);
      return;
    }

    const valid = await verifyApiKey(authKey);
    setIsAuthenticated(valid);
    setAuthReady(true);
  }

  async function loadHealth(): Promise<void> {
    setHealthLoading(true);
    try {
      const response = await fetch("/api/health");
      if (!response.ok) {
        throw new Error(`Health endpoint returned ${response.status}.`);
      }
      let payload: ApiHealthPayload;
      try {
        payload = (await response.json()) as ApiHealthPayload;
      } catch {
        throw new Error("JSON parse failed for /api/health.");
      }
      setHealth(payload);
      setHealthError("");

      if (!payload.d1.bound) {
        pushUiError("D1 binding missing or not connected.");
      } else {
        clearUiError("D1 binding missing or not connected.");
      }

      if (!payload.d1.ok) {
        pushUiError(`D1 status error: ${payload.d1.error ?? "unknown database error."}`);
      } else {
        clearUiErrorByPrefix("D1 status error:");
      }

      if ((payload.d1.error ?? "").toLowerCase().includes("no such table")) {
        pushUiError("Migration may not be applied: required tables not found in D1.");
      } else {
        clearUiError("Migration may not be applied: required tables not found in D1.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load API health.";
      setHealthError(message);
      pushUiError(message);
    } finally {
      setHealthLoading(false);
    }
  }

  async function verifyApiKey(candidate: string): Promise<boolean> {
    const response = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${candidate}`,
      },
      body: JSON.stringify({ apiKey: candidate }),
    });

    if (response.ok) {
      localStorage.setItem("evidence_dashboard_api_key", candidate);
      setAuthKey(candidate);
      setAuthError("");
      return true;
    }

    setAuthError("API key is invalid for this dashboard.");
    return false;
  }

  async function submitApiKey(): Promise<void> {
    const candidate = authKeyInput.trim();
    if (!candidate) {
      setAuthError("Enter a dashboard API key.");
      return;
    }

    const ok = await verifyApiKey(candidate);
    setIsAuthenticated(ok);
    if (ok) setAuthKeyInput("");
  }

  function clearSession(): void {
    localStorage.removeItem("evidence_dashboard_api_key");
    setAuthKey("");
    setIsAuthenticated(!authRequired);
    setAuthError("");
  }

  async function loadEvidence(): Promise<void> {
    const res = await apiFetch("/api/evidence");
    if (!res.ok) return;
    let data: { items: DashboardEvidenceItem[] };
    try {
      data = (await res.json()) as { items: DashboardEvidenceItem[] };
    } catch {
      pushUiError("JSON parse failed for /api/evidence.");
      return;
    }
    const mapped = data.items.map((item) => ({
      title: item.title,
      source: item.source_path ?? item.source_type,
      date: item.timestamp ? item.timestamp.slice(0, 10) : "",
      itemType: item.source_type,
      tenderPurpose: item.purpose_of_tender.join(", "),
      linkedFactInIssue: item.fact_in_issue,
      linkedStatutoryRules: [],
      admissibilityStatus: "contested",
      identifiedDefects: [],
      nextAction: "Run admissibility validator.",
    } satisfies EvidenceRegisterRow));
    setRows(mapped);
  }

  async function loadLedger(): Promise<void> {
    const res = await apiFetch("/api/ledger");
    if (!res.ok) return;
    let data: LedgerEntry[];
    try {
      data = (await res.json()) as LedgerEntry[];
    } catch {
      pushUiError("JSON parse failed for /api/ledger.");
      return;
    }
    setLedger(data);
  }

  async function loadContextFile(nameOverride?: string): Promise<void> {
    const requestedName = (nameOverride ?? contextFileName).trim() || "case_context.md";
    setContextLoading(true);
    setContextMessage("");

    const res = await apiFetch(`/api/context-file?name=${encodeURIComponent(requestedName)}`);
    if (!res.ok) {
      setContextMessage(`Context file load failed (${res.status}).`);
      setContextLoading(false);
      return;
    }

    let data: ContextFileApiPayload;
    try {
      data = (await res.json()) as ContextFileApiPayload;
    } catch {
      pushUiError("JSON parse failed for /api/context-file GET.");
      setContextMessage("Context file JSON parse failed.");
      setContextLoading(false);
      return;
    }

    if (!data.file) {
      setContextMessage("Context file response missing file payload.");
      setContextLoading(false);
      return;
    }

    setContextFileName(data.file.name);
    setContextSourcePath(data.file.source_path ?? `file/context/${data.file.name}`);
    setContextContent(data.file.content_text ?? "");
    setContextUpdatedAt(data.file.updated_at ?? null);

    if (data.exists) {
      setContextMessage("Context file loaded.");
    } else {
      setContextMessage("Context file not yet saved in D1. Edit and save to create it.");
    }

    setContextLoading(false);
  }

  async function saveContextFile(): Promise<void> {
    const name = contextFileName.trim() || "case_context.md";
    const sourcePath = contextSourcePath.trim() || `file/context/${name}`;

    setContextSaving(true);
    setContextMessage("");

    const res = await apiFetch("/api/context-file", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        source_path: sourcePath,
        content: contextContent,
      }),
    });

    if (!res.ok) {
      setContextMessage(`Context file save failed (${res.status}).`);
      setContextSaving(false);
      return;
    }

    let data: ContextFileApiPayload;
    try {
      data = (await res.json()) as ContextFileApiPayload;
    } catch {
      pushUiError("JSON parse failed for /api/context-file POST.");
      setContextMessage("Context file save response parse failed.");
      setContextSaving(false);
      return;
    }

    if (!data.file) {
      setContextMessage("Context file save returned empty payload.");
      setContextSaving(false);
      return;
    }

    setContextFileName(data.file.name);
    setContextSourcePath(data.file.source_path ?? sourcePath);
    setContextUpdatedAt(data.file.updated_at ?? null);
    setContextMessage("Context file saved.");
    setContextSaving(false);
    await loadLedger();
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleItemTypeChange(nextItemType: string): void {
    const nextType = getItemTypeConfig(nextItemType).value;
    const nextTypeConfig = getItemTypeConfig(nextType);
    const allowedPurposes = getAllowedPurposesForItemType(nextType);
    const nextPurpose =
      (allowedPurposes.find((option) => option.value === nextTypeConfig.defaultPurpose) ?? allowedPurposes[0] ?? TENDER_PURPOSE_OPTIONS[0])
        .value;
    const allowedFacts = getAllowedFactsForItemType(nextType);
    const nextFact =
      (allowedFacts.find((option) => option.value === nextTypeConfig.defaultFact) ?? allowedFacts[0] ?? FACT_IN_ISSUE_OPTIONS[0]).value;
    const nextStatus = normalizeStatus(getDefaultStatusForPurpose(nextPurpose), nextPurpose);

    setForm((prev) => ({
      ...prev,
      itemType: nextType,
      tenderPurpose: nextPurpose,
      linkedFactInIssue: nextFact,
      admissibilityStatus: nextStatus,
      nextAction: getDefaultNextAction(nextType, nextPurpose, nextStatus),
      localSourcePath: nextTypeConfig.defaultLocalSourcePath,
    }));

    setSelectedRules(getSuggestedRules(nextType, nextPurpose, nextFact));
    setSelectedDefects(getSuggestedDefects(nextType, nextPurpose, nextStatus));
  }

  function handlePurposeChange(nextPurposeValue: string): void {
    const nextPurpose = getPurposeConfig(nextPurposeValue).value;
    const nextStatus = normalizeStatus(form.admissibilityStatus, nextPurpose);

    setForm((prev) => ({
      ...prev,
      tenderPurpose: nextPurpose,
      admissibilityStatus: nextStatus,
      nextAction: getDefaultNextAction(prev.itemType, nextPurpose, nextStatus),
    }));

    setSelectedRules((prev) => uniqueStrings([...prev, ...getSuggestedRules(form.itemType, nextPurpose, form.linkedFactInIssue)]));
    setSelectedDefects((prev) => uniqueStrings([...prev, ...getSuggestedDefects(form.itemType, nextPurpose, nextStatus)]));
  }

  function handleFactChange(nextFact: string): void {
    updateForm("linkedFactInIssue", nextFact);
    setSelectedRules((prev) => uniqueStrings([...prev, ...getSuggestedRules(form.itemType, form.tenderPurpose, nextFact)]));
  }

  function handleStatusChange(nextStatusValue: string): void {
    const nextStatus = getStatusConfig(nextStatusValue).value;
    setForm((prev) => ({
      ...prev,
      admissibilityStatus: nextStatus,
      nextAction: getDefaultNextAction(prev.itemType, prev.tenderPurpose, nextStatus),
    }));
    setSelectedRules((prev) => uniqueStrings([...prev, ...getStatusConfig(nextStatus).requiredRules]));
    setSelectedDefects((prev) => uniqueStrings([...prev, ...getSuggestedDefects(form.itemType, form.tenderPurpose, nextStatus)]));
  }

  function handleStorageModeChange(nextStorageMode: StorageMode): void {
    setForm((prev) => {
      if (nextStorageMode === prev.storageMode) return prev;
      const next = { ...prev, storageMode: nextStorageMode };
      if (nextStorageMode === "local_path" && !next.localSourcePath.trim()) {
        next.localSourcePath = getItemTypeConfig(prev.itemType).defaultLocalSourcePath;
      }
      return next;
    });
  }

  function toggleRule(rule: string): void {
    setSelectedRules((prev) => {
      const mandatory = requiredPurposeRules.includes(rule as (typeof CORE_STATUTORY_GATES)[number]) ||
        statusConfig.requiredRules.includes(rule as (typeof CORE_STATUTORY_GATES)[number]);
      if (prev.includes(rule)) {
        if (mandatory) return prev;
        return prev.filter((r) => r !== rule);
      }
      return uniqueStrings([...prev, rule]);
    });
  }

  function toggleDefect(defect: string): void {
    setSelectedDefects((prev) => (prev.includes(defect) ? prev.filter((d) => d !== defect) : uniqueStrings([...prev, defect])));
  }

  async function submitEvidence(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (blockingErrors.length > 0) {
      setAuthError(blockingErrors[0]);
      return;
    }
    setSubmitting(true);

    const source = sourceReference(form);
    const payload: DashboardEvidenceItem = {
      id: makeId("EVI"),
      matter_id: form.matterId,
      title: form.title,
      source_type: form.itemType,
      source_path: source,
      timestamp: toApiTimestamp(form.timestamp),
      tendering_party: form.tenderingParty,
      opposing_party: "prosecution",
      fact_asserted: form.factAsserted,
      fact_in_issue: form.linkedFactInIssue,
      purpose_of_tender: [form.tenderPurpose],
      linked_charge_id: form.linkedChargeId,
      notes: form.notes,
    };

    try {
      const registerRes = await apiFetch("/api/evidence", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!registerRes.ok) throw new Error(`Register failed: ${registerRes.status}`);

      const assessRes = await apiFetch("/api/assess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!assessRes.ok) throw new Error(`Assessment failed: ${assessRes.status}`);

      let report: AdmissibilityReport;
      try {
        report = (await assessRes.json()) as AdmissibilityReport;
      } catch {
        pushUiError("JSON parse failed for /api/assess.");
        throw new Error("JSON parse failed for /api/assess.");
      }

      if (!requiredReportFieldsPresent(report)) {
        const message = "Assessment result missing required fields.";
        pushUiError(message);
        throw new Error(message);
      }

      clearUiError("Assessment result missing required fields.");
      const defectsFromReport = Array.from(new Set([...selectedDefects, ...report.missing_proof_global]));

      setRows((prev) => [
        {
          title: form.title,
          source,
          date: form.timestamp.slice(0, 10),
          itemType: form.itemType,
          tenderPurpose: form.tenderPurpose,
          linkedFactInIssue: form.linkedFactInIssue,
          linkedStatutoryRules: selectedRules,
          admissibilityStatus: form.admissibilityStatus,
          identifiedDefects: defectsFromReport,
          nextAction: form.nextAction,
          report,
        },
        ...prev,
      ]);

      setForm(INITIAL_FORM);
      setSelectedRules(getSuggestedRules(INITIAL_FORM.itemType, INITIAL_FORM.tenderPurpose, INITIAL_FORM.linkedFactInIssue));
      setSelectedDefects(getSuggestedDefects(INITIAL_FORM.itemType, INITIAL_FORM.tenderPurpose, INITIAL_FORM.admissibilityStatus));
      await loadLedger();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Submission failed.";
      setAuthError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function exportMarkdown(): void {
    const header = "# Evidence Life-Cycle Dashboard Export\n\n";
    const tableHeader =
      "| Title | Source | Date | Item Type | Tender Purpose | Fact in Issue | Rules | Status | Defects | Next Action |\n" +
      "|---|---|---|---|---|---|---|---|---|---|\n";

    const lines = rows.map((row) =>
      `| ${row.title} | ${row.source} | ${row.date} | ${row.itemType} | ${row.tenderPurpose} | ${row.linkedFactInIssue} | ${row.linkedStatutoryRules.join("; ")} | ${row.admissibilityStatus} | ${row.identifiedDefects.join("; ")} | ${row.nextAction} |`,
    );

    const blob = new Blob([header, `Core flow: ${coreFlow}\n\n`, tableHeader, ...lines], {
      type: "text/markdown;charset=utf-8",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `evidence-dashboard-export-${new Date().toISOString().slice(0, 10)}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const exhibitRegister = useMemo(
    () =>
      rows.map((row, index) => ({
        exhibitId: `EXH-${String(index + 1).padStart(3, "0")}`,
        title: row.title,
        status: row.admissibilityStatus,
      })),
    [rows],
  );
  const latestAssessedRow = useMemo(() => rows.find((row) => Boolean(row.report)), [rows]);
  const latestReport = latestAssessedRow?.report;
  const gateByName = useMemo(() => {
    const map = new Map<string, AdmissibilityReport["gate_results"][number]>();
    if (!latestReport) return map;
    for (const gate of latestReport.gate_results) {
      map.set(gate.gate.toLowerCase(), gate);
    }
    return map;
  }, [latestReport]);
  const reportAssumptions = useMemo(() => {
    if (!latestReport) return [];
    if (latestReport.assumptions_global.length > 0) return latestReport.assumptions_global;
    return uniqueStrings(latestReport.gate_results.flatMap((gate) => gate.assumptions));
  }, [latestReport]);
  const filteredRows = useMemo(() => {
    const query = evidenceQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const statusMatch = statusFilter === "all" || row.admissibilityStatus === statusFilter;
      if (!statusMatch) return false;
      if (!query) return true;

      const searchable = [
        row.title,
        row.source,
        row.itemType,
        row.tenderPurpose,
        row.linkedFactInIssue,
        row.nextAction,
        row.linkedStatutoryRules.join(" "),
        row.identifiedDefects.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [evidenceQuery, rows, statusFilter]);
  const dashboardMetrics = useMemo(
    () => ({
      registered: rows.length,
      assessed: rows.filter((row) => Boolean(row.report)).length,
      contested: rows.filter((row) => row.admissibilityStatus.toLowerCase().includes("contested")).length,
      highRisk: rows.filter((row) => {
        const value = row.admissibilityStatus.toLowerCase();
        return value.includes("inadmissible") || value.includes("potential s 137 issue") || value.includes("potential s 138 issue");
      }).length,
    }),
    [rows],
  );

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-mono text-sm text-muted-foreground">Initializing dashboard...</p>
      </div>
    );
  }

  if (authRequired && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Dashboard Authentication Required
              </CardTitle>
              <CardDescription>
                Enter `DASHBOARD_API_KEY` for this Worker to access evidence, assessment, and ledger endpoints.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="api-key">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  value={authKeyInput}
                  onChange={(e) => setAuthKeyInput(e.target.value)}
                  placeholder="Paste DASHBOARD_API_KEY"
                />
              </div>
              {authError ? <p className="text-sm text-danger">{authError}</p> : null}
              <div className="flex gap-2">
                <Button onClick={() => void submitApiKey()} className="flex-1">
                  Unlock Dashboard
                </Button>
                <Button variant="secondary" onClick={clearSession}>
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visible Sections</CardTitle>
              <CardDescription>Dashboard layout blocks rendered at root.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {["Evidence Intake", "Facts in Issue", "Evidence Act Gates", "Assessment Result", "Ledger", "Extension Points"].map((section) => (
                <div key={section} className="rounded-md border border-border bg-background/60 px-3 py-2 text-sm">
                  {section}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-grid min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
        <header className="rounded-xl border border-border bg-card/70 p-6 shadow-glow backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-blue">Evidence Life-Cycle Dashboard</p>
              <h1 className="mt-2 font-heading text-3xl font-semibold leading-tight md:text-4xl">
                Manage evidentiary material with statutory precision.
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Register evidence, map facts in issue, map Evidence Act provisions, identify defects, and generate court-ready issue summaries.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="warning">MVP: Structured Entry + Statutory Mapping</Badge>
              <Badge variant="neutral">Cloudflare Workers + D1</Badge>
              <Badge variant={r2Bound ? "success" : "warning"}>{r2Bound ? "R2 Bound" : "R2 Reference Mode"}</Badge>
              <Button variant="ghost" className="no-print" onClick={clearSession}>
                Lock
              </Button>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-background/80 px-3 py-2 font-mono text-xs text-muted-foreground">
            <ArrowRight className="h-4 w-4 text-primary" />
            <span>{coreFlow}</span>
          </div>
        </header>

        <Card className="no-print">
          <CardContent className="flex flex-wrap items-center gap-2 pt-6">
            {WORKFLOW_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
              >
                {section.label}
              </a>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Evidence Items</p>
              <p className="mt-1 text-2xl font-semibold">{dashboardMetrics.registered}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Assessed</p>
              <p className="mt-1 text-2xl font-semibold">{dashboardMetrics.assessed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Contested</p>
              <p className="mt-1 text-2xl font-semibold">{dashboardMetrics.contested}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">High-Risk Status</p>
              <p className="mt-1 text-2xl font-semibold">{dashboardMetrics.highRisk}</p>
            </CardContent>
          </Card>
        </div>

        {uiErrors.length > 0 && (
          <Card className="border-danger/40">
            <CardHeader>
              <CardTitle className="text-danger">Runtime Errors</CardTitle>
              <CardDescription>Actionable errors detected in API/data flow.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {uiErrors.map((entry) => (
                <div key={entry.id} className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
                  {entry.message}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Legal Workflow Columns</CardTitle>
            <CardDescription>Evidence Item → Fact in Issue → Purpose of Tender → Evidence Act Gates → Result → Extension Points</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Evidence Item</p>
                <p className="mt-1 text-sm">{latestAssessedRow?.title ?? "No assessed evidence yet."}</p>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Fact in Issue</p>
                <p className="mt-1 text-sm">{latestAssessedRow?.linkedFactInIssue ?? "-"}</p>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Purpose of Tender</p>
                <p className="mt-1 text-sm">{latestAssessedRow?.tenderPurpose ?? "-"}</p>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Evidence Act Gates</p>
                <p className="mt-1 text-sm">
                  {latestReport ? latestReport.gate_results.map((gate) => gate.gate).join(", ") : "-"}
                </p>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Result</p>
                <div className="mt-1">
                  <Badge variant={statusVariant(latestAssessedRow?.admissibilityStatus ?? "not assessed")}>
                    {latestAssessedRow?.admissibilityStatus ?? "not assessed"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-md border border-border bg-background/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">Extension Points</p>
                <p className="mt-1 text-sm">
                  {latestReport?.extension_report?.next_build_step?.[0] ?? "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div id="evidence-intake" className="grid gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Evidence Intake</CardTitle>
              <CardDescription>
                Every evidence item must include title, source, date, item type, tender purpose, fact in issue, statutory rules, status, defects, and next action.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitEvidence} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="matter-id">Matter ID</Label>
                    <Input id="matter-id" value={form.matterId} onChange={(e) => updateForm("matterId", e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="charge-id">linked_charge</Label>
                    <Input id="charge-id" value={form.linkedChargeId} onChange={(e) => updateForm("linkedChargeId", e.target.value)} required />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tendering-party">tendering_party</Label>
                  <Select id="tendering-party" value={form.tenderingParty} onChange={(e) => updateForm("tenderingParty", e.target.value)}>
                    <option value="defence">defence</option>
                    <option value="prosecution">prosecution</option>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="title">Title</Label>
                  <Input id="title" value={form.title} onChange={(e) => updateForm("title", e.target.value)} placeholder="BWC 09:49 officer acknowledgement" required />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="timestamp">timestamp</Label>
                    <Input
                      id="timestamp"
                      type="datetime-local"
                      value={formatTimestampInput(form.timestamp)}
                      onChange={(e) => updateForm("timestamp", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="item-type">source_type</Label>
                    <Select id="item-type" value={form.itemType} onChange={(e) => handleItemTypeChange(e.target.value)}>
                      {EVIDENCE_ITEM_TYPES.map((itemType) => (
                        <option key={itemType.value} value={itemType.value}>
                          {itemType.label}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">{typeConfig.description}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="storage-mode">Source Storage</Label>
                  <Select id="storage-mode" value={form.storageMode} onChange={(e) => handleStorageModeChange(e.target.value as StorageMode)}>
                    <option value="local_path">local path reference</option>
                    <option value="r2_uri">R2 URI reference</option>
                  </Select>
                </div>

                {form.storageMode === "local_path" ? (
                  <div className="space-y-1">
                    <Label htmlFor="local-source">Source Path</Label>
                    <Input
                      id="local-source"
                      value={form.localSourcePath}
                      onChange={(e) => updateForm("localSourcePath", e.target.value)}
                      placeholder="source_vault/bwc/clip-01.mp4"
                      required
                    />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="r2-bucket">R2 Bucket</Label>
                      <Input id="r2-bucket" value={form.r2Bucket} onChange={(e) => updateForm("r2Bucket", e.target.value)} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="r2-key">R2 Key</Label>
                      <Input id="r2-key" value={form.r2Key} onChange={(e) => updateForm("r2Key", e.target.value)} required />
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-border bg-background/60 px-3 py-2 font-mono text-xs text-muted-foreground">
                  Source reference: {sourceReference(form)}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="purpose">purpose_of_tender</Label>
                    <Select id="purpose" value={form.tenderPurpose} onChange={(e) => handlePurposeChange(e.target.value)}>
                      {availablePurposes.map((purpose) => (
                        <option key={purpose.value} value={purpose.value}>
                          {purpose.label}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">{purposeConfig.description}</p>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fact">fact_in_issue</Label>
                    <Select id="fact" value={form.linkedFactInIssue} onChange={(e) => handleFactChange(e.target.value)}>
                      {availableFacts.map((fact) => (
                        <option key={fact.value} value={fact.value}>
                          {fact.label}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {availableFacts.find((fact) => fact.value === form.linkedFactInIssue)?.description ?? "Select a fact in issue."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Linked Statutory Rules</Label>
                  <div className="grid max-h-40 gap-1 overflow-auto rounded-md border border-border p-2">
                    {CORE_STATUTORY_GATES.map((rule) => {
                      const required = requiredPurposeRules.includes(rule) || statusConfig.requiredRules.includes(rule);
                      return (
                        <label key={rule} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedRules.includes(rule)}
                          onChange={() => toggleRule(rule)}
                          disabled={required && selectedRules.includes(rule)}
                          className="mt-1"
                        />
                        <span>{rule}</span>
                        {required && (
                          <Badge variant="warning" className="ml-auto">
                            required
                          </Badge>
                        )}
                      </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Identified Defects</Label>
                  <div className="grid gap-1 rounded-md border border-border p-2">
                    {DEFECT_OPTIONS.map((defect) => (
                      <label key={defect.value} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedDefects.includes(defect.value)}
                          onChange={() => toggleDefect(defect.value)}
                          className="mt-1"
                        />
                        <span>{defect.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="status">Admissibility Status</Label>
                  <Select id="status" value={form.admissibilityStatus} onChange={(e) => handleStatusChange(e.target.value)}>
                    {availableStatuses.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="next-action">Next Action</Label>
                  <Input id="next-action" value={form.nextAction} onChange={(e) => updateForm("nextAction", e.target.value)} required />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="fact-asserted">fact_asserted</Label>
                  <Textarea
                    id="fact-asserted"
                    value={form.factAsserted}
                    onChange={(e) => updateForm("factAsserted", e.target.value)}
                    placeholder="Officer acknowledgement, chronology, representation text."
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notes">notes</Label>
                  <Textarea
                    id="notes"
                    value={form.notes}
                    onChange={(e) => updateForm("notes", e.target.value)}
                    placeholder="Concision helps counsel triage quickly."
                  />
                </div>

                <details className="rounded-md border border-border bg-background/60 p-3" open>
                  <summary className="cursor-pointer text-sm font-medium">
                    Line-By-Line Intake Checks ({lineChecks.length})
                  </summary>
                  <div className="mt-3 space-y-2">
                    {lineChecks.map((check) => (
                      <div key={check.line} className="flex items-start gap-2">
                        <Badge variant={checkVariant(check.status)}>{check.status}</Badge>
                        <div>
                          <p className="text-xs font-medium">{check.line}</p>
                          <p className="text-xs text-muted-foreground">{check.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                <Button type="submit" disabled={!canSubmit} className="w-full">
                  {submitting ? "Registering..." : "Register and Validate"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card id="evidence-register" className="xl:col-span-8">
            <CardHeader>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle>Evidence Register</CardTitle>
                  <CardDescription>
                    Do not describe evidence as finally admissible unless all required checks are complete.
                  </CardDescription>
                </div>
                <div className="no-print flex gap-2">
                  <Button variant="secondary" onClick={exportMarkdown}>
                    <FileDown className="h-4 w-4" /> Export Markdown
                  </Button>
                  <Button variant="secondary" onClick={() => window.print()}>
                    <FileText className="h-4 w-4" /> Export PDF
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label htmlFor="register-search">Search Evidence Register</Label>
                  <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-background/70 px-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="register-search"
                      value={evidenceQuery}
                      onChange={(event) => setEvidenceQuery(event.target.value)}
                      placeholder="Search title, source, fact in issue, defects, rules..."
                      className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status-filter">Filter by Status</Label>
                  <Select id="status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">all statuses</option>
                    {ADMISSIBILITY_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                Showing {filteredRows.length} of {rows.length} evidence items.
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Source Reference</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Fact in Issue</TableHead>
                    <TableHead>Rules</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Defects</TableHead>
                    <TableHead>Next Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        {rows.length === 0 ? "No evidence items registered yet." : "No results match the current search/filter."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((row, idx) => (
                      <TableRow key={`${row.title}-${idx}`}>
                        <TableCell className="font-medium">{row.title}</TableCell>
                        <TableCell className="font-mono text-xs">{row.source}</TableCell>
                        <TableCell>{row.date}</TableCell>
                        <TableCell>{row.itemType}</TableCell>
                        <TableCell>{row.tenderPurpose}</TableCell>
                        <TableCell>{row.linkedFactInIssue}</TableCell>
                        <TableCell>{row.linkedStatutoryRules.join(", ") || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(row.admissibilityStatus)}>{row.admissibilityStatus}</Badge>
                        </TableCell>
                        <TableCell>{row.identifiedDefects.join(", ") || "-"}</TableCell>
                        <TableCell>{row.nextAction}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card id="assessment-result">
          <CardHeader>
            <CardTitle>Assessment Result</CardTitle>
            <CardDescription>Relevance, Hearsay, Opinion, Admissions, Credibility, Exclusion, Proof, Voir Dire, Advance Ruling, Extensibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {latestReport ? (
              <>
                {latestReport.authority_coverage && (
                  <div className="rounded-md border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                    Authority coverage ({latestReport.authority_coverage.retrieval_mode}):{" "}
                    {latestReport.authority_coverage.matched_citations}/{latestReport.authority_coverage.requested_citations} citations matched
                    {latestReport.authority_coverage.source_titles.length > 0
                      ? ` from ${latestReport.authority_coverage.source_titles.join(", ")}`
                      : "."}
                  </div>
                )}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  {GATE_CARD_ORDER.map((gateKey) => {
                    const gate = gateByName.get(gateKey);
                    return (
                      <div key={gateKey} className="rounded-md border border-border bg-background/60 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{GATE_LABELS[gateKey]}</p>
                          <Badge variant={gateStatusVariant(gate?.status ?? "not_assessed")}>
                            {gate?.status ?? "not_assessed"}
                          </Badge>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p>
                            <span className="font-medium text-foreground">Triggered sections:</span>{" "}
                            {gate?.triggered_sections?.join("; ") || "-"}
                          </p>
                          <p className="mt-1">
                            <span className="font-medium text-foreground">Reason:</span>{" "}
                            {gate?.reasons?.[0] ?? "-"}
                          </p>
                          <details className="mt-2 rounded-md border border-border bg-background/70 px-2 py-1.5">
                            <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                              View full gate detail
                            </summary>
                            <div className="mt-2 space-y-1">
                              <p>
                                <span className="font-medium text-foreground">Objections:</span>{" "}
                                {gate?.objections?.join("; ") || "-"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Responses:</span>{" "}
                                {gate?.responses?.join("; ") || "-"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Missing proof:</span>{" "}
                                {gate?.missing_proof?.join("; ") || "-"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Assumptions:</span>{" "}
                                {gate?.assumptions?.join("; ") || "-"}
                              </p>
                              <p>
                                <span className="font-medium text-foreground">Authority text:</span>{" "}
                                {gate?.authority_matches && gate.authority_matches.length > 0
                                  ? gate.authority_matches
                                    .map((match) => `${match.citation} (${match.source_title})`)
                                    .join("; ")
                                  : "-"}
                              </p>
                              {gate?.authority_matches && gate.authority_matches.length > 0 && (
                                <div className="space-y-2 rounded-md border border-border bg-background/80 p-2">
                                  {gate.authority_matches.slice(0, 2).map((match) => (
                                    <div key={`${match.canonical_ref}-${match.citation}`}>
                                      <p className="text-[11px] font-medium text-foreground">
                                        {match.canonical_ref}
                                      </p>
                                      {match.heading ? (
                                        <p className="text-[11px] text-muted-foreground">{match.heading}</p>
                                      ) : null}
                                      <p className="text-[11px] text-muted-foreground">{match.excerpt}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </details>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Voir Dire</p>
                      <Badge variant={latestReport.voir_dire_required ? "warning" : "neutral"}>
                        {latestReport.voir_dire_required ? "required" : "not required"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Preliminary question route under s 189.
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Advance Ruling</p>
                      <Badge variant={latestReport.advance_ruling_candidate ? "warning" : "neutral"}>
                        {latestReport.advance_ruling_candidate ? "candidate" : "not flagged"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Early determination suitability based on current gate profile.
                    </p>
                  </div>

                  <div className="rounded-md border border-border bg-background/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Extensibility</p>
                      <Badge variant="info">module</Badge>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {latestReport.next_extension_module}
                    </p>
                  </div>
                </div>

                <div className="rounded-md border border-border bg-background/60 p-4">
                  <p className="mb-3 text-sm font-medium">Assessment Footer</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Missing proof</p>
                      <ul className="mt-1 list-disc pl-5 text-sm">
                        {latestReport.missing_proof_global.length > 0
                          ? latestReport.missing_proof_global.map((item) => <li key={item}>{item}</li>)
                          : <li>None listed.</li>}
                      </ul>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Assumptions</p>
                      <ul className="mt-1 list-disc pl-5 text-sm">
                        {reportAssumptions.length > 0
                          ? reportAssumptions.map((item) => <li key={item}>{item}</li>)
                          : <li>No explicit assumptions listed.</li>}
                      </ul>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Counterargument</p>
                      <p className="mt-1 text-sm">{latestReport.counterargument}</p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Next extension module</p>
                      <p className="mt-1 text-sm">{latestReport.next_extension_module}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-md border border-border px-3 py-2">
                    <p className="text-xs font-medium text-muted-foreground">Counsel priority</p>
                    <p className="mt-1 text-sm">{latestReport.counsel_priority}</p>
                  </div>
                  {latestReport.authority_coverage && latestReport.authority_coverage.unmatched_citations.length > 0 && (
                    <div className="mt-4 rounded-md border border-warning/50 bg-warning/10 px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground">Unmatched authority citations</p>
                      <p className="mt-1 text-sm">{latestReport.authority_coverage.unmatched_citations.join(", ")}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No assessment report yet. Submit via POST /api/assess or use the intake form.
              </p>
            )}
          </CardContent>
        </Card>

        <div id="reference-panels" className="grid gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Facts in Issue</CardTitle>
              <CardDescription>Keep issue articulation narrow and testable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {FACT_IN_ISSUE_OPTIONS.map((fact) => (
                <div key={fact.value} className="rounded-md border border-border bg-background/60 px-3 py-2">
                  <p className="text-sm font-medium">{fact.label}</p>
                  <p className="text-xs text-muted-foreground">{fact.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Evidence Act Gates</CardTitle>
              <CardDescription>Core statutory gates for first-pass triage.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {CORE_STATUTORY_GATES.map((rule) => (
                <div key={rule} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span>{rule}</span>
                  <Gavel className="h-4 w-4 text-primary" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                API Health and Runtime
              </CardTitle>
              <CardDescription>Live environment, database status, and development bindings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>Auth mode</span>
                <Badge variant={authRequired ? "warning" : "neutral"}>{authRequired ? "required" : "disabled"}</Badge>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <span>R2 binding status</span>
                <Badge variant={r2Bound ? "success" : "warning"}>{r2Bound ? "bound" : "reference-only"}</Badge>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-muted-foreground">
                <UploadCloud className="h-4 w-4 text-primary" />
                <span>Current MVP stores R2 references; binary upload can be enabled after bucket binding.</span>
              </div>
              {healthLoading ? (
                <p className="text-muted-foreground">Loading health status...</p>
              ) : health ? (
                <>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Worker live</span>
                    <Badge variant={health.ok ? "success" : "danger"}>{health.ok ? "yes" : "no"}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>D1 connected</span>
                    <Badge variant={health.d1.bound && health.d1.ok ? "success" : "danger"}>
                      {health.d1.bound && health.d1.ok ? "yes" : "no"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Workers AI binding</span>
                    <Badge variant={health.bindings?.ai_bound ? "success" : "warning"}>
                      {health.bindings?.ai_bound ? "bound" : "not bound"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Vectorize binding</span>
                    <Badge variant={health.bindings?.vectorize_bound ? "success" : "warning"}>
                      {health.bindings?.vectorize_bound ? "bound" : "not bound"}
                    </Badge>
                  </div>
                  <div className="rounded-md border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Semantic retrieval profile</p>
                    <p className="mt-1 font-mono text-xs">
                      {health.bindings?.vector_namespace ?? "authority-corpus-v1"} / {health.bindings?.vector_embed_model ?? "@cf/baai/bge-base-en-v1.5"}
                    </p>
                  </div>
                  <div className="rounded-md border border-border px-3 py-2">
                    <p className="text-xs text-muted-foreground">Evidence Act version loaded</p>
                    <p className="mt-1 text-sm">
                      {health.instrument} v{health.version} ({health.version_date})
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Environment</span>
                    <Badge variant="info">{health.environment}</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Last assessment time</span>
                    <span className="font-mono text-[11px]">{health.metrics.last_ledger_entry_at ?? "none"}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Ledger count</span>
                    <span className="font-mono text-xs">{health.metrics.ledger_entries}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Evidence items in D1</span>
                    <span className="font-mono text-xs">{health.metrics.evidence_items}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span>Reports in D1</span>
                    <span className="font-mono text-xs">{health.metrics.admissibility_reports}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {health.d1.ok ? "D1 probe successful." : `D1 probe error: ${health.d1.error ?? "unknown error."}`}
                  </p>
                  <Button variant="secondary" onClick={() => void loadHealth()}>
                    Refresh Health
                  </Button>
                </>
              ) : (
                <p className="text-danger">{healthError || "Health status unavailable."}</p>
              )}
            </CardContent>
          </Card>

          <Card className="xl:col-span-12">
            <CardHeader>
              <CardTitle>Context File</CardTitle>
              <CardDescription>Directly accessible matter context inside the Worker and dashboard UI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1 md:col-span-1">
                  <Label htmlFor="context-file-name">File name</Label>
                  <Input
                    id="context-file-name"
                    value={contextFileName}
                    onChange={(e) => setContextFileName(e.target.value)}
                    placeholder="case_context.md"
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="context-source-path">Source path</Label>
                  <Input
                    id="context-source-path"
                    value={contextSourcePath}
                    onChange={(e) => setContextSourcePath(e.target.value)}
                    placeholder="file/context/case_context.md"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={() => void loadContextFile()} disabled={contextLoading || contextSaving}>
                  {contextLoading ? "Loading..." : "Load Context"}
                </Button>
                <Button onClick={() => void saveContextFile()} disabled={contextSaving || contextLoading}>
                  {contextSaving ? "Saving..." : "Save Context"}
                </Button>
                <Badge variant="neutral">Updated: {contextUpdatedAt ?? "not saved"}</Badge>
              </div>

              <div className="space-y-1">
                <Label htmlFor="context-content">Context content</Label>
                <Textarea
                  id="context-content"
                  value={contextContent}
                  onChange={(e) => setContextContent(e.target.value)}
                  rows={12}
                  placeholder="# Case Context\n\nAdd factual and legal context for counsel handover."
                />
              </div>

              {contextMessage ? <p className="text-xs text-muted-foreground">{contextMessage}</p> : null}
            </CardContent>
          </Card>
        </div>

        <div id="ledger-section" className="grid gap-6 xl:grid-cols-12">
          <Card className="xl:col-span-5">
            <CardHeader>
              <CardTitle>Ledger</CardTitle>
              <CardDescription>Live activity from ledger entries.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {ledger.slice(0, 8).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2 rounded-md border border-border px-3 py-2">
                  <Clock3 className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{entry.event_type}</p>
                    <p className="font-mono text-xs text-muted-foreground">{entry.created_at}</p>
                  </div>
                </div>
              ))}
              {ledger.length === 0 && <p className="text-sm text-muted-foreground">No ledger events yet.</p>}
            </CardContent>
          </Card>

          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle>Exhibit Register</CardTitle>
              <CardDescription>Generated from current evidence list.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {exhibitRegister.map((exhibit) => (
                <div key={exhibit.exhibitId} className="rounded-md border border-border px-3 py-2">
                  <p className="font-mono text-xs text-muted-foreground">{exhibit.exhibitId}</p>
                  <p className="text-sm font-medium">{exhibit.title}</p>
                  <Badge className="mt-1" variant={statusVariant(exhibit.status)}>
                    {exhibit.status}
                  </Badge>
                </div>
              ))}
              {exhibitRegister.length === 0 && <p className="text-sm text-muted-foreground">No exhibits yet.</p>}
            </CardContent>
          </Card>

          <Card className="xl:col-span-4">
            <CardHeader>
              <CardTitle>Extension Points</CardTitle>
              <CardDescription>Next legal-runtime modules and build steps.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {(latestReport?.extension_report.new_runtime_modules_recommended ?? []).slice(0, 5).map((moduleName) => (
                <div key={moduleName} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span>{moduleName}</span>
                </div>
              ))}
              {(latestReport?.extension_report.next_build_step ?? BUILD_ORDER.slice(0, 5)).map((step, index) => (
                <div key={`${step}-${index}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <span>{step}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <footer className="rounded-lg border border-border bg-card/70 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <Scale className="h-4 w-4 text-primary" />
            <span>
              Status language enforced: admissible on current material, conditionally admissible, limited purpose only, contested,
              requires foundation/notice/leave, potential s 135/137/138 issue, inadmissible on current material.
            </span>
          </div>
          {authError ? <p className="mt-2 text-danger">{authError}</p> : null}
        </footer>
      </div>
    </div>
  );
}
