
import asyncio
import io
import wave

from gnani.stt import (
    GnaniSTTStreamClient,
    StreamErrorEvent,
    StreamTranscriptEvent,
)


SAMPLE_RATE = 16000
FRAME_BYTES = 1024
TRANSCRIPT_TIMEOUT_SECONDS = 8.0
QUIET_PERIOD_SECONDS = 2.0


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
                "Stereo conversion requires audioop. "
                "Use a mono WAV for this test."
            ) from exc

    # Keep only complete 1024-byte frames.
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
    """Stream a WAV to Gnani and log all events received from the server."""

    language_codes = {
        "en": "en-IN",
        "hi": "hi-IN",
        "hinglish": "en-IN",
    }

    language_code = language_codes.get(language)
    if not language_code:
        raise ValueError("Unsupported language selection.")

    audio_frames = wav_to_pcm_frames(wav_bytes)

    client = GnaniSTTStreamClient(
        language_code=language_code,
        sample_rate=SAMPLE_RATE,
    )

    transcript_events = []
    processing_seen = False
    stream_error = None
    receiver_task = None
    last_event_at = None
    last_transcript_at = None
    send_finished_at = None

    loop = asyncio.get_running_loop()
    start_time = loop.time()

    try:
        print(f"[STT WS] Connecting | language={language_code}")

        connected = await client.connect()

        if isinstance(connected, StreamErrorEvent):
            raise RuntimeError(
                f"Gnani streaming connection failed: {connected.message}"
            )

        print("[STT WS] Connected successfully.")

        async def receive_events():
            nonlocal processing_seen
            nonlocal stream_error
            nonlocal last_event_at
            nonlocal last_transcript_at

            async for event in client.events():
                now = loop.time()
                last_event_at = now

                event_class = type(event).__name__
                raw = getattr(event, "raw", {})
                event_type = (
                    raw.get("type", "unknown")
                    if isinstance(raw, dict)
                    else "unknown"
                )

                print(
                    f"[STT WS] Event | "
                    f"t={now - start_time:.2f}s | "
                    f"type={event_type} | "
                    f"class={event_class}"
                )

                if isinstance(event, StreamTranscriptEvent):
                    text = event.text.strip()

                    print(
                        "[STT WS] Transcript metadata | "
                        f"segment_index={getattr(event, 'segment_index', None)} | "
                        f"audio_duration_ms={getattr(event, 'audio_duration_ms', None)} | "
                        f"latency={getattr(event, 'latency', None)}"
                    )

                    if text:
                        transcript_events.append(event)
                        last_transcript_at = now
                        print(f"[STT WS] Transcript text: {text}")

                elif isinstance(event, StreamErrorEvent):
                    stream_error = event.message
                    print(f"[STT WS] ERROR: {event.message}")

                if event_type == "processing":
                    processing_seen = True
                    print("[STT WS] Processing event received.")

                if event_type in ("speech_end", "vad_end"):
                    print(
                        f"[STT WS] Speech-end event received: {event_type}"
                    )

        receiver_task = asyncio.create_task(receive_events())

        # 1024 bytes = 512 PCM16 samples = 32 ms at 16 kHz.
        seconds_per_frame = FRAME_BYTES / 2 / SAMPLE_RATE

        print(
            f"[STT WS] Sending {len(audio_frames)} frames "
            f"({len(audio_frames) * seconds_per_frame:.2f}s of audio)."
        )

        for index, frame in enumerate(audio_frames, start=1):
            if not client.is_connected:
                raise RuntimeError(
                    f"Gnani connection closed at audio frame {index}."
                )

            await client.send_audio(frame)
            await asyncio.sleep(seconds_per_frame)

        # Send approximately 1 second of silence to help Gnani VAD
        # detect the end of the final speech segment.
        print("[STT WS] Sending 1 second of trailing silence.")

        silence_frame = bytes(FRAME_BYTES)

        for index in range(32):
            if not client.is_connected:
                raise RuntimeError(
                    "Gnani connection closed while sending trailing silence."
                )

            await client.send_audio(silence_frame)
            await asyncio.sleep(seconds_per_frame)

        send_finished_at = loop.time()

        print(
            f"[STT WS] Audio and trailing silence complete at "
            f"t={send_finished_at - start_time:.2f}s."
        )
        print("[STT WS] Waiting for final transcript events.")

        deadline = loop.time() + TRANSCRIPT_TIMEOUT_SECONDS

        while loop.time() < deadline:
            if stream_error:
                raise RuntimeError(
                    f"Gnani streaming error: {stream_error}"
                )

            now = loop.time()

            # Measure quiet time using transcript events only.
            if (
                transcript_events
                and last_transcript_at is not None
                and send_finished_at is not None
                and now - max(last_transcript_at, send_finished_at)
                >= QUIET_PERIOD_SECONDS
            ):
                print(
                    "[STT WS] Transcript quiet period reached "
                    f"({QUIET_PERIOD_SECONDS:.1f}s)."
                )
                break

            await asyncio.sleep(0.1)

        if stream_error:
            raise RuntimeError(
                f"Gnani streaming error: {stream_error}"
            )

        if not transcript_events:
            raise RuntimeError(
                "Gnani returned no transcript before the timeout."
            )

        transcript = " ".join(
            event.text.strip()
            for event in transcript_events
            if event.text.strip()
        ).strip()

        return {
            "transcript": transcript,
            "transcript_events": len(transcript_events),
            "audio_frames": len(audio_frames),
            "audio_duration_seconds": round(
                len(audio_frames) * FRAME_BYTES / 2 / SAMPLE_RATE,
                2,
            ),
            "trailing_silence_seconds": 1.0,
            "processing_event_seen": processing_seen,
            "time_to_send_complete_seconds": round(
                send_finished_at - start_time, 2
            ) if send_finished_at is not None else None,
            "last_event_seconds_after_start": round(
                last_event_at - start_time, 2
            ) if last_event_at is not None else None,
            "last_transcript_seconds_after_start": round(
                last_transcript_at - start_time, 2
            ) if last_transcript_at is not None else None,
            "transcript_quiet_period_seconds": QUIET_PERIOD_SECONDS,
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
            print("[STT WS] Connection closed.")


async def main():
    from pathlib import Path
    from dotenv import load_dotenv

    load_dotenv()

    wav_path = Path(
        r"C:\Users\akshb\Downloads\voiceover_16k.wav"
    )

    if not wav_path.exists():
        raise FileNotFoundError(f"Test WAV not found: {wav_path}")

    wav_bytes = wav_path.read_bytes()
    result = await transcribe_wav_stream(wav_bytes, language="en")

    print("\n--- FINAL STREAM RESULT ---")
    for key, value in result.items():
        print(f"{key}: {value}")


if __name__ == "__main__":
    asyncio.run(main())
