import { getApiBaseUrl } from "@/shared/config/service_urls.config";
import { requestJson } from "@/shared/http/request_json.util";
import type { CallIdentityRecord } from "@/shared/types/call.type";
import type {
  AuditEventFilter,
  AuditEventPage,
  BatchApproveResult,
  BatchGroup,
  CallTimeline,
  CaseDecisionRequest,
  CaseDecisionResult,
  CasePack,
  CustomerNotification,
  DecisionExplanation,
  EndedCallSummary,
  EngineCase,
  TamperTestResult,
} from "@/shared/types/case.type";
import type {
  AutonomyOverview,
  AutonomyProposal,
  Caller,
  CallerDetails,
  CustomerOverview,
  DashboardKpis,
  DemoConfig,
  Escalation,
  JourneyComparison,
  PromptVersion,
  RegisteredAction,
  RoutingOverview,
  StaffMember,
  StaffStatus,
  Workforce,
} from "@/shared/types/resources.type";

/** Client for the `api` service (REST API, system of record, decisioning). */

function callApi<ResponseBody>(request: {
  path: string;
  method?: "GET" | "POST" | "PATCH";
  query?: object;
  body?: unknown;
}): Promise<ResponseBody> {
  return requestJson<ResponseBody>({ base_url: getApiBaseUrl(), ...request, path: `/api${request.path}` });
}

export interface CaseListFilter {
  status?: string;
  call_id?: string;
  customer_id?: string;
  action_code?: string;
  limit?: number;
}

// Demo
export const fetchDemoConfig = () => callApi<DemoConfig>({ path: "/demo/config" });
export const resetDemo = () => callApi<{ is_reset: boolean }>({ path: "/demo/reset", method: "POST", body: {} });
/** The simulated phone's crib sheet (demo mode only): the answers to the caller's own identity questions. */
export const fetchCallerDetails = (customer_id: string) => callApi<CallerDetails>({ path: `/demo/callers/${customer_id}/details` });

// Identity (the api's authoritative record of the knowledge checks on a call)
export const fetchCallIdentity = (call_id: string) => callApi<CallIdentityRecord>({ path: `/identity/calls/${call_id}` });

// Banking (read-only views through the core banking adapter)
export const fetchCallers = () => callApi<Caller[]>({ path: "/banking/callers" });
export const fetchCustomerOverview = (customer_id: string) =>
  callApi<CustomerOverview>({ path: `/banking/customers/${customer_id}/overview` });

// Cases and approvals
export const fetchCases = (filter: CaseListFilter = {}) => callApi<EngineCase[]>({ path: "/cases", query: filter });
export const fetchCasePack = (case_number: string) => callApi<CasePack>({ path: `/cases/${case_number}` });
export const fetchApprovalInbox = () => callApi<EngineCase[]>({ path: "/approvals/inbox" });
export const fetchBatchGroups = () => callApi<BatchGroup[]>({ path: "/approvals/batch_groups" });
export const decideCase = (case_number: string, decision_request: CaseDecisionRequest) =>
  callApi<CaseDecisionResult>({ path: `/cases/${case_number}/decision`, method: "POST", body: decision_request });
export const batchApproveCases = (batch_request: { staff_id: string; case_numbers: string[]; reason_code: string }) =>
  callApi<BatchApproveResult>({ path: "/approvals/batch_approve", method: "POST", body: batch_request });

// Notifications (the simulated customer phone)
export const fetchNotifications = (filter: { customer_id?: string; call_id?: string; limit?: number }) =>
  callApi<CustomerNotification[]>({ path: "/notifications", query: filter });
export const respondToNotification = (notification_id: string, response: "APPROVED" | "DENIED") =>
  callApi<CustomerNotification>({ path: `/notifications/${notification_id}/response`, method: "POST", body: { response } });

// Audit and explainability
export const fetchAuditEvents = (filter: AuditEventFilter = {}) =>
  callApi<AuditEventPage>({ path: "/audit/events", query: filter });
export const runAuditTamperTest = () => callApi<TamperTestResult>({ path: "/audit/tamper_test", method: "POST", body: {} });
export const fetchDecisionExplanation = (case_number: string) =>
  callApi<DecisionExplanation>({ path: `/explanations/cases/${case_number}` });
export const fetchEndedCalls = (limit = 30) =>
  callApi<EndedCallSummary[]>({ path: "/explanations/calls", query: { status: "ended", limit } });
export const fetchCallTimeline = (call_id: string) => callApi<CallTimeline>({ path: `/explanations/calls/${call_id}/timeline` });

// Resources
export const fetchWorkforce = () => callApi<Workforce>({ path: "/resources/workforce" });
export const updateStaffStatus = (staff_id: string, status: StaffStatus) =>
  callApi<StaffMember>({ path: `/resources/staff/${staff_id}/status`, method: "PATCH", body: { status } });
export const fetchRoutingOverview = () => callApi<RoutingOverview>({ path: "/resources/routing" });
export const fetchActionRegistry = () => callApi<{ actions: RegisteredAction[] }>({ path: "/resources/registry" });
export const fetchPromptVersions = () => callApi<PromptVersion[]>({ path: "/resources/prompt_versions" });
export const fetchAutonomyOverview = () => callApi<AutonomyOverview>({ path: "/resources/autonomy" });
export const proposeAutonomy = (proposal_request: { staff_id: string; action_code: string }) =>
  callApi<AutonomyProposal>({ path: "/resources/autonomy/proposals", method: "POST", body: proposal_request });
export const signOffAutonomyProposal = (proposal_id: number, staff_id: string) =>
  callApi<AutonomyProposal>({ path: `/resources/autonomy/proposals/${proposal_id}/sign_off`, method: "POST", body: { staff_id } });

// Dashboard
export const fetchDashboardKpis = () => callApi<DashboardKpis>({ path: "/dashboard/kpis" });
export const fetchEscalations = () => callApi<Escalation[]>({ path: "/dashboard/escalations" });

// Before and after
export const fetchJourneyComparison = () => callApi<JourneyComparison>({ path: "/compare" });
