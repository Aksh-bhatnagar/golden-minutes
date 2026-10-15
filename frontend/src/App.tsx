
import { useRef, useState } from "react";
import {
  Phone,
  PhoneOff,
  ShieldAlert,
  Mic,
  CheckCircle2,
  AlertCircle,
  CircleHelp,
  Copy,
  ArrowLeft,
  UserRound,
  Volume2,
} from "lucide-react";
import "./App.css";

type Screen = "ready" | "call" | "review";
type Language = "en" | "hi" | "hinglish";
type FieldStatus = "confirmed" | "unclear" | "missing";

type ReportField = {
  label: string;
  value: string;
  status: FieldStatus;
};

type ApiReport = {
  fraud_type: string | null;
  bank_or_payment_app: string | null;
  amount_inr: number | null;
  transaction_reference: string | null;
  incident_date: string | null;
  incident_time: string | null;
  registered_phone_last4: string | null;
  contacted_bank: "yes" | "no" | "unknown";
  otp_or_pin_shared: "yes" | "no" | "unknown";
  missing_fields: string[];
  confirmed_by_user: boolean;
};

type QuestionResult = {
  question?: { field: string; question: string } | null;
  response?: string;
  action?: "ask" | "clarify" | "confirm";
  current_field?: string | null;
  needs_review?: boolean;
  report?: ApiReport;
  summary?: unknown;
};

const API_BASE = "http://localhost:8000/api";

const initialFields: ReportField[] = [
  { label: "Fraud method", value: "", status: "missing" },
  { label: "Amount lost (₹)", value: "", status: "missing" },
  { label: "Transaction ID", value: "", status: "missing" },
  { label: "Bank or payment app", value: "", status: "missing" },
  { label: "Incident date and time", value: "", status: "missing" },
  { label: "Contacted bank?", value: "", status: "missing" },
  { label: "OTP/PIN shared?", value: "", status: "missing" },
];

const prompts: Record<Language, string> = {
  en: "I'm here to help organize the details. Please tell me what happened, in your own words.",
  hi: "मैं जानकारी व्यवस्थित करने में आपकी मदद करूँगा। कृपया अपने शब्दों में बताइए कि क्या हुआ।",
  hinglish:
    "Main details organize karne mein help karunga. Aap apne words mein bataiye kya hua.",
};

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataSize = frames * bytesPerSample;
  const wav = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wav);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = Array.from(
    { length: buffer.numberOfChannels },
    (_, i) => buffer.getChannelData(i),
  );

  let offset = 44;

  for (let i = 0; i < frames; i++) {
    let sample = 0;

    for (const channel of channels) {
      sample += channel[i] / channels.length;
    }

    sample = Math.max(-1, Math.min(1, sample));
    view.setInt16(
      offset,
      sample < 0 ? sample * 32768 : sample * 32767,
      true,
    );
    offset += 2;
  }

  return new Blob([wav], { type: "audio/wav" });
}

function App() {
  const [screen, setScreen] = useState<Screen>("ready");
  const [language, setLanguage] = useState<Language>("en");
  const [fields, setFields] = useState<ReportField[]>(initialFields);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("Ready to begin");
  const [sampleLoaded, setSampleLoaded] = useState(false);
  const [confirmNumbers, setConfirmNumbers] = useState(false);
  const [notice, setNotice] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentField, setCurrentField] = useState<string | null>(null);
  const [assistantQuestion, setAssistantQuestion] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }

    setIsSpeaking(false);
  };

  const speakText = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText) return;

    stopSpeaking();
    setStatus("Generating assistant speech...");

    try {
      const response = await fetch(`${API_BASE}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText, language }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || `Speech synthesis failed (${response.status}).`,
        );
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setIsSpeaking(false);
          setStatus("Ready for your answer");
        }

        if (audioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        }
      };

      audio.onerror = () => {
        if (audioRef.current === audio) {
          audioRef.current = null;
          setIsSpeaking(false);
          setStatus("Speech playback failed. You can still read the question.");
        }

        if (audioUrlRef.current === audioUrl) {
          URL.revokeObjectURL(audioUrl);
          audioUrlRef.current = null;
        }
      };

      setIsSpeaking(true);
      setStatus("Assistant is speaking...");
      await audio.play();
    } catch (error) {
      setIsSpeaking(false);
      setStatus(
        error instanceof Error
          ? `Speech unavailable: ${error.message}`
          : "Speech unavailable. You can still read the question.",
      );
    }
  };

  const buildApiReport = (): ApiReport => {
    const value = (label: string) =>
      fields.find((field) => field.label === label)?.value.trim() || "";

    const amountText = value("Amount lost (₹)").replace(/,/g, "");
    const parsedAmount = amountText
      ? Number(amountText.replace(/[^\d.]/g, ""))
      : null;

    const incident = value("Incident date and time");
    const contactedBank = value("Contacted bank?").toLowerCase();
    const otpShared = value("OTP/PIN shared?").toLowerCase();

    return {
      fraud_type: value("Fraud method") || null,
      bank_or_payment_app: value("Bank or payment app") || null,
      amount_inr:
        parsedAmount !== null &&
        Number.isFinite(parsedAmount) &&
        parsedAmount >= 0
          ? parsedAmount
          : null,
      transaction_reference: value("Transaction ID") || null,
      incident_date: incident || null,
      incident_time: null,
      registered_phone_last4: null,
      contacted_bank:
        contactedBank === "yes" || contactedBank === "no"
          ? contactedBank
          : "unknown",
      otp_or_pin_shared:
        otpShared === "yes" || otpShared === "no" ? otpShared : "unknown",
      missing_fields: [],
      confirmed_by_user: false,
    };
  };

  const applyApiReport = (report: ApiReport) => {
    const displayValue = (
      value: string | number | null | undefined,
      unknownText = "",
    ) => {
      if (value === null || value === undefined || value === "") {
        return unknownText;
      }
      return String(value);
    };

    const mapStatus = (value: string, unknown = false): FieldStatus => {
      if (!value || unknown) return "missing";
      return "unclear";
    };

    setFields([
      {
        label: "Fraud method",
        value: displayValue(report.fraud_type),
        status: mapStatus(displayValue(report.fraud_type)),
      },
      {
        label: "Amount lost (₹)",
        value: displayValue(report.amount_inr),
        status: mapStatus(displayValue(report.amount_inr)),
      },
      {
        label: "Transaction ID",
        value: displayValue(report.transaction_reference),
        status: mapStatus(displayValue(report.transaction_reference)),
      },
      {
        label: "Bank or payment app",
        value: displayValue(report.bank_or_payment_app),
        status: mapStatus(displayValue(report.bank_or_payment_app)),
      },
      {
        label: "Incident date and time",
        value: [
          report.incident_date,
          report.incident_time,
        ]
          .filter(Boolean)
          .join(" "),
        status: mapStatus(
          [report.incident_date, report.incident_time]
            .filter(Boolean)
            .join(" "),
        ),
      },
      {
        label: "Contacted bank?",
        value:
          report.contacted_bank === "unknown"
            ? ""
            : report.contacted_bank,
        status: mapStatus(
          report.contacted_bank,
          report.contacted_bank === "unknown",
        ),
      },
      {
        label: "OTP/PIN shared?",
        value:
          report.otp_or_pin_shared === "unknown"
            ? ""
            : report.otp_or_pin_shared,
        status: mapStatus(
          report.otp_or_pin_shared,
          report.otp_or_pin_shared === "unknown",
        ),
      },
    ]);
  };

  const requestNextQuestion = async () => {
    const response = await fetch(`${API_BASE}/conversation/next`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: buildApiReport() }),
    });

    if (!response.ok) {
      throw new Error(`Conversation service error (${response.status}).`);
    }

    return (await response.json()) as {
      question?: { field: string; question: string } | null;
      summary?: unknown;
    };
  };

  const beginIntake = async () => {
    setIsStarting(true);
    setNotice("");
    setSampleLoaded(false);
    setTranscript("");
    setFields(initialFields);
    setCurrentField(null);
    setAssistantQuestion("");
    stopSpeaking();
    setStatus("Connecting to the conversation service...");

    try {
      const response = await fetch(`${API_BASE}/conversation/next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report: {
            fraud_type: null,
            bank_or_payment_app: null,
            amount_inr: null,
            transaction_reference: null,
            incident_date: null,
            incident_time: null,
            registered_phone_last4: null,
            contacted_bank: "unknown",
            otp_or_pin_shared: "unknown",
            missing_fields: [],
            confirmed_by_user: false,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          error.detail || `Conversation service error (${response.status}).`,
        );
      }

      const result = (await response.json()) as {
        question?: { field: string; question: string } | null;
      };

      if (!result.question) {
        throw new Error(
          "The backend did not return a question. Check the report schema and conversation service.",
        );
      }

      setAssistantQuestion(result.question.question);
      setCurrentField(result.question.field);
      setScreen("call");
      void speakText(result.question.question);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Could not connect to the backend.",
      );
    } finally {
      setIsStarting(false);
    }
  };

  const startRecording = async () => {
    if (isRecording || isTranscribing || isStarting) return;

    stopSpeaking();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires localhost or HTTPS.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        setStatus("Converting audio and transcribing...");

        try {
          const webm = new Blob(chunksRef.current, {
            type: recorder.mimeType || "audio/webm",
          });

          if (!webm.size) {
            throw new Error("No audio was recorded. Please try again.");
          }

          const audioContext = new AudioContext();

          try {
            const audioBuffer = await audioContext.decodeAudioData(
              await webm.arrayBuffer(),
            );
            const wav = audioBufferToWav(audioBuffer);

            const sttResponse = await fetch(
              `${API_BASE}/stt?language=${language}&filename=recording.wav`,
              {
                method: "POST",
                headers: { "Content-Type": "audio/wav" },
                body: wav,
              },
            );

            if (!sttResponse.ok) {
              const error = await sttResponse.json().catch(() => ({}));
              throw new Error(
                error.detail ||
                  `Transcription failed (${sttResponse.status}).`,
              );
            }

            const sttResult: { transcript: string } =
              await sttResponse.json();
            const recognizedText = sttResult.transcript.trim();

            if (!recognizedText) {
              throw new Error("No speech was recognized. Please try again.");
            }

            setTranscript((current) =>
              `${current}${current ? "\n\n" : ""}Caller: ${recognizedText}`,
            );

            if (!currentField) {
              throw new Error(
                "There is no active question. Please restart the intake.",
              );
            }

            setStatus("Updating the report...");

            const turnResponse = await fetch(`${API_BASE}/conversation/turn`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                report: buildApiReport(),
                transcript: recognizedText,
                current_field: currentField,
              }),
            });

            if (!turnResponse.ok) {
              const error = await turnResponse.json().catch(() => ({}));
              throw new Error(
                error.detail ||
                  `Conversation update failed (${turnResponse.status}).`,
              );
            }

            const turnResult =
              (await turnResponse.json()) as QuestionResult;

            if (turnResult.report) {
              applyApiReport(turnResult.report);
            }

            const nextQuestion = turnResult.response?.trim() || "";

            setAssistantQuestion(nextQuestion);

            if (turnResult.action === "clarify") {
              // Keep the same field so a clarification answers the same question.
              setStatus("Please clarify your answer.");
            } else if (turnResult.action === "confirm") {
              setCurrentField(null);
              setStatus("Details collected — review the report.");
            } else {
              setCurrentField(turnResult.current_field || null);
              setStatus("Answer processed.");
            }

            if (nextQuestion) {
              void speakText(nextQuestion);
            }

            if (turnResult.action === "confirm") {
              setNotice(
                "The intake details have been collected. Review them carefully before using the summary.",
              );
            }
          } finally {
            await audioContext.close();
          }
        } catch (error) {
          setStatus(
            error instanceof Error
              ? error.message
              : "Audio processing failed.",
          );
        } finally {
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          recorderRef.current = null;
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
      setStatus("Listening — speak clearly");
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;

      setStatus(
        error instanceof Error
          ? error.message
          : "Could not access the microphone.",
      );
    }
  };

  const stopRecording = () => {
    const recorder = recorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  };

  const updateField = (index: number, value: string) => {
    setSampleLoaded(false);
    setFields((current) =>
      current.map((field, i) =>
        i === index
          ? {
              ...field,
              value,
              status: value.trim() ? "unclear" : "missing",
            }
          : field,
      ),
    );
  };

  const loadSample = () => {
    stopSpeaking();

    setFields([
      {
        label: "Fraud method",
        value: "UPI payment fraud",
        status: "confirmed",
      },
      { label: "Amount lost (₹)", value: "5000", status: "unclear" },
      { label: "Transaction ID", value: "", status: "missing" },
      {
        label: "Bank or payment app",
        value: "Not provided",
        status: "unclear",
      },
      { label: "Incident date and time", value: "", status: "missing" },
      { label: "Contacted bank?", value: "Not confirmed", status: "unclear" },
      { label: "OTP/PIN shared?", value: "Not confirmed", status: "unclear" },
    ]);

    setTranscript(
      "Caller: I sent ₹5,000 through UPI after someone contacted me. I think it was a scam.",
    );
    setSampleLoaded(true);
    setStatus("Demo data loaded — not a real report");
    setScreen("review");
  };

  const summary = [
    "GOLDEN MINUTES — INTAKE SUMMARY",
    "Prototype summary — not an official complaint",
    "",
    ...fields.map(
      (field) =>
        `${field.label}: ${field.value.trim() || "MISSING"} [${field.status.toUpperCase()}]`,
    ),
    "",
    "Transcript:",
    transcript || "No transcript captured.",
    "",
    "Next step: Contact 1930 immediately if money was lost to cyber fraud.",
  ].join("\n");

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setNotice("Summary copied.");
    } catch {
      setNotice("Copy unavailable. Select and copy the summary manually.");
    }
  };

  const reset = () => {
    stopSpeaking();

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;

    setScreen("ready");
    setFields(initialFields);
    setTranscript("");
    setStatus("Ready to begin");
    setSampleLoaded(false);
    setConfirmNumbers(false);
    setNotice("");
    setCurrentField(null);
    setAssistantQuestion("");
    setIsRecording(false);
    setIsTranscribing(false);
  };

  const endIntake = () => {
    stopSpeaking();

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }

    setScreen("review");
  };

  const counts = {
    confirmed: fields.filter((field) => field.status === "confirmed").length,
    unclear: fields.filter((field) => field.status === "unclear").length,
    missing: fields.filter((field) => field.status === "missing").length,
  };

  return (
    <main className="app-shell">
      <div className="emergency-banner">
        <ShieldAlert size={19} />
        <div>
          <strong>Lost money to cyber fraud?</strong>
          <span> Call 1930 immediately. Do not wait for this assistant.</span>
        </div>
      </div>

      <header className="app-header">
        <div className="brand-mark">
          <ShieldAlert size={22} />
        </div>
        <div>
          <strong>Golden Minutes</strong>
          <small>Multilingual fraud intake assistant</small>
        </div>
        <span className="prototype-badge">PROTOTYPE</span>
      </header>

      {screen === "ready" && (
        <section className="screen ready-screen">
          <p className="eyebrow">HELP STARTS WITH YOUR STORY</p>
          <h1>Let’s organize what happened.</h1>
          <p className="muted">
            Speak in the language you're comfortable with. We'll help prepare
            the important details for a human operator.
          </p>

          <div className="panel">
            <label htmlFor="language">Choose your language</label>
            <select
              id="language"
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as Language)
              }
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="hinglish">Hinglish</option>
            </select>

            <div className="privacy-note">
              <ShieldAlert size={18} />
              <span>
                Never share an OTP, PIN, password, CVV, or full card number.
              </span>
            </div>

            <button
              className="primary-button"
              onClick={beginIntake}
              disabled={isStarting}
            >
              <Phone size={19} />
              {isStarting ? "Connecting..." : "Start intake"}
            </button>

            <p className="microcopy">
              Starts a local prototype session. This does not file an official
              complaint.
            </p>
            {status !== "Ready to begin" && (
              <p className="notice" role="status">
                {status}
              </p>
            )}
          </div>

          <button className="secondary-button" onClick={loadSample}>
            Try sample report <ArrowLeft size={16} />
          </button>
        </section>
      )}

      {screen === "call" && (
        <section className="screen call-screen">
          <p className="eyebrow">INTAKE SESSION</p>

          <div className="call-orb">
            {isSpeaking ? <Volume2 size={36} /> : <Mic size={36} />}
          </div>

          <h1>I'm listening to your story.</h1>
          <p className="muted">
            {assistantQuestion || prompts[language]}
          </p>

          <div className="status-line" role="status">
            <span className="status-dot" />
            {status}
          </div>

          <div className="call-actions">
            <button
              className="primary-button"
              onClick={startRecording}
              disabled={isRecording || isTranscribing || isStarting}
            >
              <Mic size={18} />
              {isTranscribing ? "Processing..." : "Start recording"}
            </button>

            {isRecording && (
              <button className="end-button" onClick={stopRecording}>
                <PhoneOff size={18} />
                Stop and process answer
              </button>
            )}

            {isSpeaking && (
              <button className="secondary-button" onClick={stopSpeaking}>
                Stop assistant audio
              </button>
            )}
          </div>

          <div className="panel transcript-panel">
            <h3>Conversation transcript</h3>
            <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
              {transcript || "Your conversation transcript will appear here."}
            </p>
          </div>

          <div className="call-actions">
            <button
              className="secondary-button"
              onClick={() => {
                stopSpeaking();
                setScreen("review");
              }}
            >
              Review report
            </button>

            <button className="end-button" onClick={endIntake}>
              <PhoneOff size={18} />
              End intake
            </button>
          </div>

          <button className="text-button" onClick={loadSample}>
            Load synthetic demo data
          </button>
        </section>
      )}

      {screen === "review" && (
        <section className="screen review-screen">
          <button className="back-button" onClick={() => setScreen("call")}>
            <ArrowLeft size={17} /> Back to intake
          </button>

          <p className="eyebrow">PREPARED FOR HUMAN REVIEW</p>
          <h1>Review the details.</h1>
          <p className="muted">
            Check each field. Anything uncertain must be confirmed, not assumed.
          </p>

          {sampleLoaded && (
            <div className="demo-notice">
              Synthetic example only. These details do not describe a real
              victim.
            </div>
          )}

          <div className="summary-counts">
            <div>
              <CheckCircle2 />
              <strong>{counts.confirmed}</strong>
              <span>Confirmed</span>
            </div>
            <div>
              <AlertCircle />
              <strong>{counts.unclear}</strong>
              <span>Unclear</span>
            </div>
            <div>
              <CircleHelp />
              <strong>{counts.missing}</strong>
              <span>Missing</span>
            </div>
          </div>

          <div className="field-list">
            {fields.map((field, index) => (
              <article className="field-card" key={field.label}>
                <div className="field-heading">
                  <label htmlFor={`field-${index}`}>{field.label}</label>
                  <span className={`field-status ${field.status}`}>
                    {field.status}
                  </span>
                </div>

                <input
                  id={`field-${index}`}
                  value={field.value}
                  placeholder="Not provided yet"
                  onChange={(event) => updateField(index, event.target.value)}
                />

                {field.label === "Amount lost (₹)" && field.value && (
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={confirmNumbers}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setConfirmNumbers(checked);

                        setFields((current) =>
                          current.map((item, i) =>
                            i === index
                              ? {
                                  ...item,
                                  status: checked ? "confirmed" : "unclear",
                                }
                              : item,
                          ),
                        );
                      }}
                    />
                    Caller has explicitly confirmed this amount
                  </label>
                )}
              </article>
            ))}
          </div>

          <div className="panel transcript-panel">
            <h3>
              <UserRound size={18} /> Transcript
            </h3>
            <textarea
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Transcript will appear here after voice integration."
              rows={4}
            />
          </div>

          <div className="review-actions">
            <button className="primary-button" onClick={copySummary}>
              <Copy size={18} /> Copy operator summary
            </button>

            <button
              className="secondary-button"
              onClick={() =>
                window.open(
                  "https://www.cybercrime.gov.in/",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              Cybercrime portal
            </button>

            <button className="secondary-button" onClick={reset}>
              New intake
            </button>
          </div>

          {notice && (
            <p role="status" className="notice">
              {notice}
            </p>
          )}

          <p className="microcopy">
            This prototype does not submit complaints or contact an operator.
            If money was lost, call 1930 immediately.
          </p>
        </section>
      )}

      <footer>
        <ShieldAlert size={15} />
        An intake assistant, not a replacement for 1930 or a bank.
      </footer>
    </main>
  );
}

export default App;
