
import asyncio
from functools import partial

from fastapi.concurrency import run_in_threadpool
from gnani.stt import GnaniSTTClient


LANGUAGE_CODES = {
    "en": "en-IN",
    "hi": "hi-IN",
    # Use Indian English as the initial Hinglish recognition setting.
    # Validate mixed Hindi-English recognition during testing.
    "hinglish": "en-IN",
}


def _transcribe(
    audio_bytes: bytes,
    filename: str,
    language_code: str,
) -> dict:
    client = GnaniSTTClient()

    return client.transcribe_bytes(
        audio_bytes,
        filename=filename,
        language_code=language_code,
    )


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str,
    language: str = "en",
) -> str:
    if not audio_bytes:
        raise ValueError("The uploaded audio is empty.")

    language_code = LANGUAGE_CODES.get(language)
    if not language_code:
        raise ValueError("Unsupported language selection.")

    result = await run_in_threadpool(
        partial(
            _transcribe,
            audio_bytes,
            filename,
            language_code,
        )
    )

    transcript = result.get("transcript", "")
    if not isinstance(transcript, str) or not transcript.strip():
        raise RuntimeError("Speech recognition returned no transcript.")

    return transcript.strip()
