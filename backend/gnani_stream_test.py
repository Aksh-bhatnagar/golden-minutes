import asyncio
import io
import sys
import wave
from pathlib import Path

from dotenv import load_dotenv
from gnani.stt import (
    GnaniSTTStreamClient,
    StreamErrorEvent,
    StreamTranscriptEvent,
)

SAMPLE_RATE = 16000
FRAME_BYTES = 1024
TRANSCRIPT_TIMEOUT_SECONDS = 8.0
QUIET_PERIOD_SECONDS = 2.0

# Friendly names map to Gnani codes. Anything else is passed through as is.
LANGUAGE_CODES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "hinglish": "en-IN",
}

TEST_CODES = [
    "en",
    "hi",
    "en-hi-IN-latn",
    "en-hi-in-cm",
    getattr(GnaniSTTStreamClient, "AUTO_DETECT", "AUTO_DETECT"),
]


def wav_to_pcm_frames(wav_bytes: bytes) -> list[bytes]:
    """Convert a mono/stereo, 16 kHz PCM16 WAV into 1024-byte PCM frames."""
    with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
        channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        sample_rate = wav.getframerate()
        frames = wav.readframes(wav.getnframes())

    if sample_width != 2:
        raise ValueError("Test WAV must use 16-bit PCM audio.")

    if channels not in (1, 2):
        raise ValueError("Test WAV must be mono or stereo.")

    if sample_rate != SAMPLE_RATE:
        raise ValueError("Test WAV must be sampled at 16000 Hz.")

    if channels == 2:
        try:
            import audioop

            frames = audioop.tomono(frames, 2, 0.5, 0.5)
        except ImportError as exc:
            raise RuntimeError(
                "Stereo conversion requires audioop. Use a mono WAV."
            ) from exc

    frames = frames[: len(frames) - (len(frames) % FRAME_BYTES)]

    if not frames:
        raise ValueError("WAV contains no complete audio frames.")

    return [
        frames[i:i + FRAME_BYTES]
        for i in range(0, len(frames), FRAME_BYTES)
    ]


async def transcribe_wav_stream(
    wav_bytes: bytes,
    language: str = "en",
) -> dict:
    """Stream a WAV to Gnani and log what the server sends back."""

    language_code = LANGUAGE_CODES.get(language, language)
    audio_frames = wav_to_pcm_frames(wav_bytes)

    client = GnaniSTTStreamClient(
        language_code=language_code,
        sample_rate=SAMPLE_RATE,
    )

    transcript_events = []
    stream_error = None
    receiver_task = None
    last_transcript_at = None
    send_finished_at = None

    loop = asyncio.get_running_loop()
    start_time = loop.time()

    try:
        connected = await client.connect()

        if isinstance(connected, StreamErrorEvent):
            raise RuntimeError(
                f"Gnani streaming connection failed: {connected.message}"
            )

        async def receive_events():
            nonlocal stream_error, last_transcript_at

            async for event in client.events():
                now = loop.time()
                raw = getattr(event, "raw", {})

                if isinstance(event, StreamTranscriptEvent):
                    text = event.text.strip()
                    print(f"  raw: {raw}")

                    if text:
                        transcript_events.append(event)
                        last_transcript_at = now
                        print(f"  text: {text}")

                elif isinstance(event, StreamErrorEvent):
                    stream_error = event.message
                    print(f"  ERROR: {event.message}")

        receiver_task = asyncio.create_task(receive_events())

        # 1024 bytes = 512 PCM16 samples = 32 ms at 16 kHz.
        seconds_per_frame = FRAME_BYTES / 2 / SAMPLE_RATE

        for frame in audio_frames:
            if not client.is_connected:
                raise RuntimeError("Gnani connection closed while sending.")

            await client.send_audio(frame)
            await asyncio.sleep(seconds_per_frame)

        # About 1 second of silence so VAD closes the last segment.
        silence_frame = bytes(FRAME_BYTES)

        for _ in range(32):
            if not client.is_connected:
                raise RuntimeError("Gnani connection closed during silence.")

            await client.send_audio(silence_frame)
            await asyncio.sleep(seconds_per_frame)

        send_finished_at = loop.time()
        deadline = loop.time() + TRANSCRIPT_TIMEOUT_SECONDS

        while loop.time() < deadline:
            if stream_error:
                raise RuntimeError(f"Gnani streaming error: {stream_error}")

            now = loop.time()

            if (
                transcript_events
                and last_transcript_at is not None
                and now - max(last_transcript_at, send_finished_at)
                >= QUIET_PERIOD_SECONDS
            ):
                break

            await asyncio.sleep(0.1)

        if stream_error:
            raise RuntimeError(f"Gnani streaming error: {stream_error}")

        if not transcript_events:
            raise RuntimeError("Gnani returned no transcript before timeout.")

        transcript = " ".join(
            e.text.strip() for e in transcript_events if e.text.strip()
        ).strip()

        return {
            "transcript": transcript,
            "segments": len(transcript_events),
        }

    finally:
        if receiver_task is not None:
            receiver_task.cancel()
            try:
                await receiver_task
            except asyncio.CancelledError:
                pass

        if client.is_connected:
            await client.close()


async def main():
    load_dotenv()

    wav_path = Path(sys.argv[1] if len(sys.argv) > 1 else "hinglish.wav")

    if not wav_path.exists():
        raise FileNotFoundError(f"Test WAV not found: {wav_path}")

    wav_bytes = wav_path.read_bytes()
    summary = []

    for code in TEST_CODES:
        print(f"\n===== {code} =====")

        try:
            result = await transcribe_wav_stream(wav_bytes, language=code)
            summary.append((code, result["transcript"]))
        except Exception as exc:
            print(f"  FAILED: {exc}")
            summary.append((code, f"FAILED: {exc}"))

    print(f"\n\n########## SUMMARY for {wav_path.name} ##########")
    for code, text in summary:
        print(f"[{code}]\n   {text}\n")


if __name__ == "__main__":
    asyncio.run(main())