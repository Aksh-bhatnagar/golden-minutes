from functools import partial

from fastapi.concurrency import run_in_threadpool
from gnani.tts import AudioConfig, GnaniTTSClient


TTS_LANGUAGES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "hinglish": "hi-IN",
    "bn": "bn-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "mr": "mr-IN",
    "pa": "pa-IN",
    "ta": "ta-IN",
    "te": "te-IN",
}

# Reused across requests to avoid reconnecting every time.
_client = GnaniTTSClient()

# Repeated lines (opening, closing, warnings) are synthesized once.
_CACHE: dict[tuple[str, str], bytes] = {}
_CACHE_MAX_ITEMS = 100
_CACHE_MAX_CHARS = 300

_AUDIO_CONFIG = AudioConfig(
    container="wav",
    encoding="linear_pcm",
    sample_rate=16000,
    num_channels=1,
    sample_width=2,
)


def _synthesize(text: str, language: str) -> bytes:
    return _client.synthesize(
        text=text,
        voice="Kaveri",
        model="timbre-v2.5",
        language=language,
        speed=1.0,
        audio_config=_AUDIO_CONFIG,
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

    key = (text, language_code)
    cached = _CACHE.get(key)
    if cached:
        return cached

    audio = await run_in_threadpool(
        partial(_synthesize, text, language_code)
    )

    if not audio:
        raise RuntimeError("Speech synthesis returned no audio.")

    if len(text) <= _CACHE_MAX_CHARS and len(_CACHE) < _CACHE_MAX_ITEMS:
        _CACHE[key] = audio

    return audio