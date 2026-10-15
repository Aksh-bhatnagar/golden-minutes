from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

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


class NextQuestionRequest(BaseModel):
    report: FraudReport


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


class TTSRequest(BaseModel):
    text: str
    language: str = "en"


@router.post("/stt")
async def speech_to_text(
    request: Request,
    language: str = "en",
    filename: str = "recording.wav",
):
    # Initial prototype limit: 10 MB per audio upload.
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file is too large.")

    audio_bytes = await request.body()

    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty.")

    if len(audio_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio file is too large.")

    if filename.rsplit(".", 1)[-1].lower() not in {
        "wav", "mp3", "flac", "ogg", "m4a"
    }:
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio format. Use WAV, MP3, FLAC, OGG, or M4A.",
        )

    try:
        transcript = await transcribe_audio(
            audio_bytes=audio_bytes,
            filename=filename,
            language=language,
        )
        return {"transcript": transcript, "language": language}

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        # Keep provider details and credentials out of the client response.
        print(f"[STT] Provider request failed: {type(exc).__name__}")
        raise HTTPException(
            status_code=502,
            detail="Speech recognition failed. Check backend logs.",
        ) from exc


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
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        print(f"[TTS] Provider request failed: {type(exc).__name__}")
        raise HTTPException(
            status_code=502,
            detail="Speech synthesis failed. Check backend logs.",
        ) from exc
        

from pydantic import BaseModel, Field


class ConversationTurnRequest(BaseModel):
    report: FraudReport
    transcript: str = Field(min_length=1, max_length=3000)
    current_field: str | None = None


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

