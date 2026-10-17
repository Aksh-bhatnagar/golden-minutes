
import { apiRequest, getApiBase } from "@/services/api";
import type { SupportedLanguage } from "@/types/conversation";
import type {
  ConversationTurnResponse,
  FraudReport,
  SavedReportResponse,
  WorkflowCredentials,
} from "@/types/report";

interface CreateDraftResponse {
  workflow_id: string;
  access_token: string;
  status: string;
  report: FraudReport;
}

export function submitConversationTurn(
  report: FraudReport,
  transcript: string,
  currentField: string | null,
): Promise<ConversationTurnResponse> {
  return apiRequest<ConversationTurnResponse>("/conversation/turn", {
    method: "POST",
    body: JSON.stringify({
      report,
      transcript,
      current_field: currentField,
    }),
  });
}

export async function synthesizeSpeech(
  text: string,
  language: SupportedLanguage,
): Promise<Blob> {
  const response = await fetch(`${getApiBase()}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });

  if (!response.ok) {
    throw new Error("Unable to generate assistant speech.");
  }

  return response.blob();
}

export async function createReportDraft(
  report: FraudReport,
): Promise<WorkflowCredentials> {
  const result = await apiRequest<CreateDraftResponse>(
    "/report-workflow/drafts",
    {
      method: "POST",
      body: JSON.stringify({ report }),
    },
  );

  return {
    workflow_id: result.workflow_id,
    access_token: result.access_token,
  };
}

function workflowRequest<T>(
  credentials: WorkflowCredentials,
  action: string,
  method: "GET" | "POST" = "POST",
  body?: unknown,
): Promise<T> {
  return apiRequest<T>(
    `/report-workflow/drafts/${encodeURIComponent(credentials.workflow_id)}${action}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${credentials.access_token}`,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  );
}

export function reviewReport(
  credentials: WorkflowCredentials,
  mode: "all" | "field",
  field?: string,
) {
  return workflowRequest<unknown>(credentials, "/review", "POST", {
    mode,
    ...(field ? { field } : {}),
  });
}

export function confirmReport(credentials: WorkflowCredentials) {
  return workflowRequest<unknown>(credentials, "/confirm");
}

export function giveReportConsent(
  credentials: WorkflowCredentials,
  consent: boolean,
) {
  return workflowRequest<unknown>(credentials, "/consent", "POST", {
    consent,
  });
}

export function saveReport(
  credentials: WorkflowCredentials,
): Promise<SavedReportResponse> {
  return workflowRequest<SavedReportResponse>(credentials, "/save");
}
