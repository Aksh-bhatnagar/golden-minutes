
import asyncio

from fastapi import (
    APIRouter,
    HTTPException,
    Request,
    Response,
    WebSocket,
    WebSocketDisconnect,
)
from pydantic import BaseModel, Field

from gnani.stt import GnaniSTTStreamClient, StreamErrorEvent, StreamTranscriptEvent

from app.services.gnani_stt import transcribe_audio
from app.services.gnani_tts import synthesize_speech
from app.core.safety import get_safety_notice
from app.models.report import FraudReport
from app.services.conversation import (
    build_report_summary,
    get_next_question,
    update_report_from_answer,
)

router = APIRouter(prefix="/api", tags=["Golden 15"])

FRAME_BYTES = 1024

LANGUAGE_CODES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "hinglish": "en-IN",
}


class NextQuestionRequest(BaseModel):
    report: FraudReport


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


class ConversationTurnRequest(BaseModel):
    report: FraudReport
    transcript: str = Field(min_length=1, max_length=3000)
    current_field: str | None = None


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
    question = get_next_question(report)

    return {
        "question": question,
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

    if content_length and int(content_length) > 10 * 1024 * 1024:
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
            "transcript": transcript,
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
                    transcript = event.text.strip()

                    if transcript:
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
        audio_bytes = await synthesize_speech(
            text=payload.text,
            language=payload.language,
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
def conversation_turn(payload: ConversationTurnRequest):
    report, needs_review = update_report_from_answer(
        report=payload.report,
        transcript=payload.transcript,
        current_field=payload.current_field,
    )

    next_item = get_next_question(report)
    summary = build_report_summary(report)

    if needs_review:
        response = (
            "I may not have captured that correctly. "
            "Could you clarify your answer?"
        )
        action = "clarify"

    elif next_item:
        response = next_item["question"]
        action = "ask"

    else:
        response = (
            "I've collected the requested details. "
            "Please review them before confirming the report."
        )
        action = "confirm"

    return {
        "report": report.model_dump(),
        "response": response,
        "action": action,
        "current_field": next_item["field"] if next_item else None,
        "needs_review": needs_review,
        "summary": summary,
    }
