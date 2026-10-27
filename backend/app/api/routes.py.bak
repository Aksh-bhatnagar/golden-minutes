from typing import Literal
from pydantic import BaseModel, Field
from time import perf_counter
import asyncio

from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)

from gnani.stt import GnaniSTTStreamClient, StreamErrorEvent, StreamTranscriptEvent

from app.services.gnani_stt import transcribe_audio
from app.services.gnani_tts import synthesize_speech
from app.core.safety import get_safety_notice
from app.models.report import FraudReport
from app.services.conversation import (
    build_report_summary,
    process_conversation_answer,
)
from app.services.llm import redact_sensitive_secrets
from app.core.timing import log

router = APIRouter(prefix="/api", tags=["Golden minutes"])

FRAME_BYTES = 1024

LANGUAGE_CODES = {
    "auto": "en-IN",
    "en": "en-IN",
    "hi": "hi-IN",
    "hinglish": "en-IN",
    "bn": "bn-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "pa": "pa-IN",
    "ta": "ta-IN",
    "te": "te-IN",
}

OPENINGS = {
    "en": (
        "Hi, I'm Golden Minutes, an AI assistant on the cybercrime helpline desk. "
        "I'm sorry you're going through this. "
        "Tell me what happened, in your own words. Take your time."
    ),
    "hi": (
        "नमस्ते, मैं Golden Minutes हूँ, साइबर क्राइम हेल्पलाइन डेस्क की AI असिस्टेंट। "
        "मुझे अफ़सोस है कि आपके साथ ऐसा हुआ। "
        "आप आराम से बताइए, क्या हुआ?"
    ),
    "hinglish": (
        "Hi, मैं Golden Minutes हूँ, cybercrime helpline desk की AI assistant। "
        "मुझे अफ़सोस है कि आपके साथ ऐसा हुआ। "
        "आप आराम से बताइए, क्या हुआ?"
    ),
    "bn": "নমস্কার, আমি Golden Minutes, সাইবার ক্রাইম হেল্পলাইনের AI সহকারী। কী হয়েছে, আপনি ধীরে ধীরে বলুন।",
    "gu": "નમસ્તે, હું Golden Minutes છું, સાયબર ક્રાઇમ હેલ્પલાઇનની AI સહાયક. શું થયું, તમે શાંતિથી જણાવો.",
    "kn": "ನಮಸ್ಕಾರ, ನಾನು Golden Minutes, ಸೈಬರ್ ಕ್ರೈಂ ಹೆಲ್ಪ್‌ಲೈನ್‌ನ AI ಸಹಾಯಕ. ಏನಾಯಿತು ಎಂದು ನಿಧಾನವಾಗಿ ಹೇಳಿ.",
    "ml": "നമസ്കാരം, ഞാൻ Golden Minutes, സൈബർ ക്രൈം ഹെൽപ്പ്‌ലൈനിലെ AI സഹായി. എന്താണ് സംഭവിച്ചതെന്ന് പതുക്കെ പറയൂ.",
    "mr": "नमस्कार, मी Golden Minutes, सायबर क्राइम हेल्पलाइनची AI सहाय्यक. काय झालं ते शांतपणे सांगा.",
    "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ Golden Minutes ਹਾਂ, ਸਾਈਬਰ ਕ੍ਰਾਈਮ ਹੈਲਪਲਾਈਨ ਦੀ AI ਸਹਾਇਕ। ਕੀ ਹੋਇਆ, ਤੁਸੀਂ ਆਰਾਮ ਨਾਲ ਦੱਸੋ।",
    "ta": "வணக்கம், நான் Golden Minutes, சைபர் கிரைம் உதவி எண்ணின் AI உதவியாளர். என்ன நடந்தது என்று நிதானமாகச் சொல்லுங்கள்.",
    "te": "నమస్కారం, నేను Golden Minutes, సైబర్ క్రైమ్ హెల్ప్‌లైన్ AI సహాయకురాలిని. ఏమి జరిగిందో నెమ్మదిగా చెప్పండి.",
}


class NextQuestionRequest(BaseModel):
    report: FraudReport
    language: str = "en"

class TTSRequest(BaseModel):
    text: str
    language: str = "en"


class HistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=3000)


class ConversationTurnRequest(BaseModel):
    report: FraudReport
    transcript: str = Field(min_length=1, max_length=3000)
    current_field: str | None = None
    language: str = "en"
    conversation_history: list[HistoryItem] = Field(
        default_factory=list, max_length=10
    )


@router.get("/health")
def health():
    return {"status": "ok", "application": "Golden 15"}


@router.get("/safety")
def safety():
    return {
        "notice": get_safety_notice(),
        "official_service": False,
    }


@router.get("/report/schema")
def report_schema():
    return FraudReport.model_json_schema()

@router.post("/conversation/next")
def next_question(payload: NextQuestionRequest):
    report = payload.report

    # Start naturally. Let the caller explain before beginning follow-ups.

    return {
        "question": {
            "field": "fraud_type",
            "question": OPENINGS.get(payload.language, OPENINGS["en"]),
        },
        "summary": build_report_summary(report),
    }



@router.post("/stt")
async def speech_to_text(
    request: Request,
    language: str = "en",
    filename: str = "recording.wav",
):
    # Initial prototype limit: 10 MB per audio upload.
    content_length = request.headers.get("content-length")

    if (
        content_length
        and content_length.isdigit()
        and int(content_length) > 10 * 1024 * 1024
    ):
        raise HTTPException(
            status_code=413,
            detail="Audio file is too large.",
        )

    audio_bytes = await request.body()

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Audio file is empty.",
        )

    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail="Audio file is too large.",
        )

    if filename.rsplit(".", 1)[-1].lower() not in {
        "wav", "mp3", "flac", "ogg", "m4a"
    }:
        raise HTTPException(
            status_code=415,
            detail=(
                "Unsupported audio format. "
                "Use WAV, MP3, FLAC, OGG, or M4A."
            ),
        )

    try:
        transcript = await transcribe_audio(
            audio_bytes=audio_bytes,
            filename=filename,
            language=language,
        )

        return {
            "transcript": redact_sensitive_secrets(transcript),
            "language": language,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        print(f"[STT] Provider request failed: {type(exc).__name__}")

        raise HTTPException(
            status_code=502,
            detail="Speech recognition failed. Check backend logs.",
        ) from exc


@router.websocket("/stt/stream")
async def speech_to_text_stream(
    websocket: WebSocket,
    language: str = "en",
):
    """
    Relay continuous 1024-byte PCM16 audio frames to Gnani streaming STT.

    Incoming WebSocket messages:
        Binary: one 1024-byte PCM16 mono audio frame.

    Outgoing WebSocket messages:
        JSON: ready, transcript, processing, error, or closed events.
    """

    await websocket.accept()

    language_code = LANGUAGE_CODES.get(language.lower())

    if not language_code:
        await websocket.send_json({
            "type": "error",
            "message": "Unsupported language. Use en, hi, or hinglish.",
        })
        await websocket.close(code=1008)
        return

    client = GnaniSTTStreamClient(
        language_code=language_code,
        sample_rate=16000,
    )

    receiver_task = None

    try:
        print(f"[STT WS API] Connecting | language={language_code}")

        connected = await client.connect()

        if isinstance(connected, StreamErrorEvent):
            raise RuntimeError(
                f"Gnani connection failed: {connected.message}"
            )

        print("[STT WS API] Gnani connection established.")

        async def forward_gnani_events():
            async for event in client.events():
                raw = getattr(event, "raw", {})
                event_type = (
                    raw.get("type", "unknown")
                    if isinstance(raw, dict)
                    else "unknown"
                )

                if isinstance(event, StreamTranscriptEvent):
                    transcript = redact_sensitive_secrets(event.text.strip())

                    if transcript:
                        log(
                            "STT",
                            f"transcript to browser "
                            f"(audio {getattr(event, 'audio_duration_ms', None)}ms, "
                            f"gnani latency {getattr(event, 'latency', None)}ms): "
                            f"{transcript[:60]!r}",
                        )
                        await websocket.send_json({
                            "type": "transcript",
                            "text": transcript,
                            "segment_index": getattr(
                                event, "segment_index", None
                            ),
                            "audio_duration_ms": getattr(
                                event, "audio_duration_ms", None
                            ),
                        })

                elif isinstance(event, StreamErrorEvent):
                    print(f"[STT WS API] Gnani error: {event.message}")

                    await websocket.send_json({
                        "type": "error",
                        "message": "Gnani speech recognition reported an error.",
                    })

                else:
                    await websocket.send_json({
                        "type": "processing",
                        "event": event_type,
                    })

        receiver_task = asyncio.create_task(forward_gnani_events())

        await websocket.send_json({
            "type": "ready",
            "language": language_code,
            "sample_rate": 16000,
            "frame_bytes": FRAME_BYTES,
        })

        print("[STT WS API] Ready for audio frames.")

        while True:
            audio_frame = await websocket.receive_bytes()

            if len(audio_frame) != FRAME_BYTES:
                await websocket.send_json({
                    "type": "error",
                    "message": (
                        f"Invalid audio frame: expected {FRAME_BYTES} bytes, "
                        f"received {len(audio_frame)} bytes."
                    ),
                })
                continue

            if not client.is_connected:
                raise RuntimeError("Gnani streaming connection was closed.")

            await client.send_audio(audio_frame)

    except WebSocketDisconnect:
        print("[STT WS API] Browser disconnected.")

    except asyncio.CancelledError:
        raise

    except Exception as exc:
        print(f"[STT WS API] Failed: {type(exc).__name__}: {exc}")

        try:
            await websocket.send_json({
                "type": "error",
                "message": "Live speech recognition failed.",
            })
            await websocket.close(code=1011)
        except Exception:
            pass

    finally:
        if receiver_task is not None:
            receiver_task.cancel()

            try:
                await receiver_task
            except asyncio.CancelledError:
                pass
            except Exception as exc:
                print(
                    "[STT WS API] Event receiver stopped: "
                    f"{type(exc).__name__}"
                )

        if client.is_connected:
            try:
                await client.close()
            except Exception as exc:
                print(
                    "[STT WS API] Gnani cleanup failed: "
                    f"{type(exc).__name__}"
                )

        print("[STT WS API] Session ended.")


@router.post("/tts")
async def text_to_speech(payload: TTSRequest):
    try:
        started = perf_counter()
        audio_bytes = await synthesize_speech(
            text=payload.text,
            language=payload.language,
        )
        log(
            "TTS",
            f"{perf_counter() - started:.2f}s | {len(payload.text)} chars | "
            f"lang={payload.language} | {len(audio_bytes) // 1024}KB",
        )

        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={"Cache-Control": "no-store"},
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        print(f"[TTS] Provider request failed: {type(exc).__name__}")

        raise HTTPException(
            status_code=502,
            detail="Speech synthesis failed. Check backend logs.",
        ) from exc



@router.post("/conversation/turn")
async def conversation_turn(payload: ConversationTurnRequest):
    started = perf_counter()

    try:
        result = await process_conversation_answer(
            report=payload.report,
            transcript=payload.transcript,
            current_field=payload.current_field,
            language=payload.language,
            conversation_history=[
                item.model_dump() for item in payload.conversation_history
            ],
        )

        log(
            "TURN",
            f"total={perf_counter() - started:.2f}s path={result.get('path')} "
            f"lang={payload.language} in={payload.transcript[:50]!r} "
            f"reply={result['response'][:100]!r}",
        )
        return {
            "report": result["report"].model_dump(),
            "response": result["response"],
            "action": result["action"],
            "current_field": result["current_field"],
            "needs_review": result["needs_review"],
            "review_fields": result["review_fields"],
            "summary": result["summary"],
            "model": result["model"],
            "language": result.get("language", "en"),
        }

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    except RuntimeError as exc:
        log("TURN", f"failed: {exc}")
        raise HTTPException(
            status_code=502,
            detail="The conversation service is temporarily unavailable.",
        ) from exc


