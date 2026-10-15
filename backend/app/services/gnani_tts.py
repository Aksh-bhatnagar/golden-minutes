
from functools import partial

from fastapi.concurrency import run_in_threadpool
from gnani.tts import AudioConfig, GnaniTTSClient


TTS_LANGUAGES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "hinglish": "hi-IN",
}


def _synthesize(text: str, language: str) -> bytes:
    client = GnaniTTSClient()

    return client.synthesize(
        text=text,
        voice="Kaveri",
        model="timbre-v2.5",
        language=language,
        speed=1.0,
        audio_config=AudioConfig(
            container="wav",
            encoding="linear_pcm",
            sample_rate=48000,
            num_channels=1,
            sample_width=2,
        ),
    )


async def synthesize_speech(
    text: str,
    language: str = "en",
) -> bytes:
    text = text.strip()

    if not text:
        raise ValueError("Speech text cannot be empty.")

    if len(text) > 1000:
        raise ValueError("Speech text exceeds the prototype limit.")

    language_code = TTS_LANGUAGES.get(language)
    if not language_code:
        raise ValueError("Unsupported language selection.")

    audio = await run_in_threadpool(
        partial(_synthesize, text, language_code)
    )

    if not audio:
        raise RuntimeError("Speech synthesis returned no audio.")

    return audio
