
export type YesNoUnknown = "yes" | "no" | "unknown";

export interface FraudReport {
  fraud_type: string | null;
  bank_or_payment_app: string | null;
  amount_inr: number | null;
  transaction_reference: string | null;
  incident_date: string | null;
  incident_time: string | null;
  registered_phone_last4: string | null;
  otp_or_pin_shared: YesNoUnknown;
  contacted_bank: YesNoUnknown;
  missing_fields: string[];
  confirmed_by_user: boolean;
  consent_to_save: boolean;
}

export interface ConversationTurnResponse {
  report: FraudReport;
  response: string;
  action: string;
  current_field: string | null;
  needs_review: boolean;
  review_fields: string[];
  summary: string;
  model: string;
}

export interface WorkflowCredentials {
  workflow_id: string;
  access_token: string;
}

export interface SavedReportResponse {
  status: "saved";
  reference: string;
  message: string;
}

export function createEmptyReport(): FraudReport {
  return {
    fraud_type: null,
    bank_or_payment_app: null,
    amount_inr: null,
    transaction_reference: null,
    incident_date: null,
    incident_time: null,
    registered_phone_last4: null,
    otp_or_pin_shared: "unknown",
    contacted_bank: "unknown",
    missing_fields: [],
    confirmed_by_user: false,
    consent_to_save: false,
  };
}
