import { useCallback, useRef, useState } from "react";
import { apiRequest } from "@/services/api";
import {
  confirmReport,
  createReportDraft,
  giveReportConsent,
  reviewReport,
  saveReport,
} from "@/services/conversationApi";
import {
  createEmptyReport,
  type FraudReport,
  type SavedReportResponse,
  type WorkflowCredentials,
} from "@/types/report";

export type ReportWorkflowStage =
  | "idle"
  | "reviewing"
  | "confirming"
  | "awaiting_consent"
  | "saving"
  | "saved"
  | "declined"
  | "error";

const editableFields: (keyof FraudReport)[] = [
  "fraud_type",
  "bank_or_payment_app",
  "amount_inr",
  "transaction_reference",
  "incident_date",
  "incident_time",
  "registered_phone_last4",
  "otp_or_pin_shared",
  "contacted_bank",
];

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Something went wrong. Your report draft has been kept. Please try again.";
}

async function applyCorrections(
  credentials: WorkflowCredentials,
  previousReport: FraudReport,
  updatedReport: FraudReport,
): Promise<void> {
  for (const field of editableFields) {
    if (sameValue(previousReport[field], updatedReport[field])) {
      continue;
    }

    await apiRequest(
      `/report-workflow/drafts/${encodeURIComponent(
        credentials.workflow_id,
      )}/correct`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${credentials.access_token}`,
        },
        body: JSON.stringify({
          field,
          value: updatedReport[field],
        }),
      },
    );
  }
}

export function useReportWorkflow() {
  const [stage, setStage] = useState<ReportWorkflowStage>("idle");
  const [report, setReport] = useState<FraudReport>(createEmptyReport);
  const [reference, setReference] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const credentialsRef = useRef<WorkflowCredentials | null>(null);
  const reportRef = useRef<FraudReport>(createEmptyReport());
  const busyRef = useRef(false);

  const updateReport = useCallback((nextReport: FraudReport) => {
    reportRef.current = nextReport;
    setReport(nextReport);
  }, []);

  const beginReview = useCallback(
    async (initialReport: FraudReport) => {
      if (busyRef.current) return;

      busyRef.current = true;
      setBusy(true);
      setError(null);
      setMessage(null);

      try {
        let credentials = credentialsRef.current;

        if (!credentials) {
          credentials = await createReportDraft(initialReport);
          credentialsRef.current = credentials;

          // Keep the report locally even if a later API call fails.
          updateReport(initialReport);
        } else {
          await applyCorrections(
            credentials,
            reportRef.current,
            initialReport,
          );
          updateReport(initialReport);
        }

        await reviewReport(credentials, "all");
        setStage("reviewing");
      } catch (cause) {
        setError(getErrorMessage(cause));
        setStage("error");
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [updateReport],
  );

  const saveCorrections = useCallback(
    async (updatedReport: FraudReport) => {
      const credentials = credentialsRef.current;

      if (!credentials || busyRef.current) return;

      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        await applyCorrections(
          credentials,
          reportRef.current,
          updatedReport,
        );

        await reviewReport(credentials, "all");

        updateReport(updatedReport);
        setStage("reviewing");
      } catch (cause) {
        setError(getErrorMessage(cause));
        setStage("error");
        throw cause;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [updateReport],
  );

  const confirmDetails = useCallback(
    async (updatedReport?: FraudReport) => {
      const credentials = credentialsRef.current;

      if (!credentials || busyRef.current) return;

      busyRef.current = true;
      setBusy(true);
      setError(null);

      try {
        if (
          updatedReport &&
          !sameValue(updatedReport, reportRef.current)
        ) {
          await applyCorrections(
            credentials,
            reportRef.current,
            updatedReport,
          );

          updateReport(updatedReport);
        }

        await reviewReport(credentials, "all");

        setStage("confirming");
        await confirmReport(credentials);

        setStage("awaiting_consent");
      } catch (cause) {
        setError(getErrorMessage(cause));
        setStage("error");
        throw cause;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [updateReport],
  );

  const submitConsent = useCallback(async (consent: boolean) => {
    const credentials = credentialsRef.current;

    if (!credentials || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setError(null);

    try {
      await giveReportConsent(credentials, consent);

      if (!consent) {
        setStage("declined");
        setMessage("The report was not saved.");
        return;
      }

      setStage("saving");

      const result: SavedReportResponse = await saveReport(credentials);

      setReference(result.reference);
      setMessage(result.message);
      setStage("saved");
    } catch (cause) {
      setError(getErrorMessage(cause));
      setStage("error");
      throw cause;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const resetWorkflow = useCallback(() => {
    if (busyRef.current) return;

    credentialsRef.current = null;

    const emptyReport = createEmptyReport();

    reportRef.current = emptyReport;
    setReport(emptyReport);
    setReference(null);
    setMessage(null);
    setError(null);
    setStage("idle");
  }, []);

  return {
    stage,
    report,
    reference,
    message,
    error,
    busy,
    beginReview,
    saveCorrections,
    confirmDetails,
    submitConsent,
    resetWorkflow,
    updateReport,
  };
}