import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileText, RefreshCw } from "lucide-react";
import { apiRequest, getApiBase } from "@/services/api";
import type { FraudReport } from "@/types/report";

type Status = "new" | "in_progress" | "resolved";
type Priority = "high" | "medium" | "low";

interface Item {
  reference: string;
  created_at: string;
  status: Status;
  priority: Priority;
  report: FraudReport;
  display?: Record<string, string>;
}

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
};

const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-emerald-100 text-emerald-700",
};

const ROWS: [keyof FraudReport, string][] = [
  ["caller_name", "Caller name"],
  ["fraud_type", "What happened"],
  ["bank_or_payment_app", "Bank or payment app"],
  ["amount_inr", "Amount (₹)"],
  ["transaction_reference", "Transaction ID"],
  ["incident_date", "Date"],
  ["incident_time", "Time"],
  ["registered_phone_last4", "Phone, last 4 digits"],
  ["otp_or_pin_shared", "OTP or PIN shared"],
  ["contacted_bank", "Bank contacted"],
];

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return value === "unknown" ? "Not sure" : String(value);
}

export default function HandlerPage({ onExit }: { onExit: () => void }) {
  const [token, setToken] = useState(() => sessionStorage.getItem("g15_admin") ?? "");
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const headers = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Item[]>("/admin/reports", { headers: headers() });
      setItems(data);
      setAuthed(true);
      setError(null);
      sessionStorage.setItem("g15_admin", token);
    } catch (cause) {
      setAuthed(false);
      setError(cause instanceof Error ? cause.message : "Could not load reports.");
    }
  }, [token, headers]);

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(() => void load(), 3000);
    return () => clearInterval(id);
  }, [authed, load]);

  async function openPdf(reference: string) {
    const win = window.open("", "_blank");
    const res = await fetch(`${getApiBase()}/admin/reports/${reference}/pdf`, {
      headers: headers(),
    });
    if (!res.ok) {
      win?.close();
      setError("PDF not found.");
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    if (win) win.location.href = url;
  }

  async function setStatus(reference: string, status: Status) {
    try {
      await apiRequest(`/admin/reports/${reference}/status`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ status }),
      });
      void load();
    } catch {
      setError("Could not update the status.");
    }
  }

  const current = items.find((i) => i.reference === selected) ?? items[0];
  const high = items.filter((i) => i.priority === "high" && i.status !== "resolved").length;

  if (!authed) {
    return (
      <main className="mx-auto w-full max-w-md px-5 pb-12 pt-6">
        <button onClick={onExit} className="btn-light !min-h-10 mb-6 !px-4">
          <ArrowLeft size={16} /> Back
        </button>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <p className="text-xs font-semibold tracking-widest text-violet">HANDLER CONSOLE</p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight">Sign in</h1>
          <input
            className="input mt-5"
            type="password"
            placeholder="Handler token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
          {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
          <button type="submit" className="btn-dark mt-5 w-full">Open console</button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-12 pt-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-widest text-violet">HANDLER CONSOLE · DEMO</p>
          <h1 className="text-3xl font-medium tracking-tight">
            Incoming <span className="grad-text">reports</span>
          </h1>
          <p className="mt-1 text-sm text-mute">
            {items.length} total · {high} high priority open ·{" "}
            <span className="inline-flex items-center gap-1">
              <RefreshCw size={12} /> live
            </span>
          </p>
        </div>
        <button onClick={onExit} className="btn-light !min-h-10 !px-4">
          <ArrowLeft size={16} /> Exit
        </button>
      </div>

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {items.length === 0 ? (
        <div className="card text-center text-sm text-mute">No reports yet. They appear here as soon as a caller submits one.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-[320px_1fr]">
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.reference}>
                <button
                  onClick={() => setSelected(i.reference)}
                  className={`w-full rounded-2xl border p-4 text-left transition ${
                    current?.reference === i.reference ? "border-violet bg-white" : "border-line bg-white/70 hover:bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{i.reference}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[i.priority]}`}>
                      {i.priority}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm">{i.report.fraud_type ?? "No description"}</p>
                  <p className="mt-1 text-xs text-mute">
                    {STATUS_LABEL[i.status]} · {new Date(i.created_at).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>

          {current && (
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-mono text-xl font-semibold">{current.reference}</h2>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${PRIORITY_STYLE[current.priority]}`}>
                  {current.priority} priority
                </span>
              </div>

              <dl className="mt-5 divide-y divide-line text-sm">
                {ROWS.map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-4 py-2.5">
                    <dt className="text-mute">{label}</dt>
                    <dd className="text-right font-medium">{current.display?.[key as string] ?? show(current.report[key])}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button onClick={() => void openPdf(current.reference)} className="btn-dark">
                  <FileText size={17} /> Open report PDF
                </button>
                <select
                  value={current.status}
                  onChange={(e) => void setStatus(current.reference, e.target.value as Status)}
                  className="btn-light cursor-pointer"
                  aria-label="Report status"
                >
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  );
}