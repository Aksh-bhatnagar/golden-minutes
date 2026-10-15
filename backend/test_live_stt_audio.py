
import asyncio
import json
import time
import wave
from pathlib import Path

import websockets


AUDIO_PATH = Path(r"C:\Users\akshb\Downloads\voiceover_16k.wav")
WS_URL = "ws://127.0.0.1:8000/api/stt/stream?language=en"

FRAME_BYTES = 1024
SAMPLE_RATE = 16000
TRAILING_SILENCE_SECONDS = 1.0


def load_pcm_frames(path: Path):
    with wave.open(str(path), "rb") as wav:
        if wav.getframerate() != SAMPLE_RATE:
            raise ValueError("Audio must be 16000 Hz.")
        if wav.getsampwidth() != 2:
            raise ValueError("Audio must be 16-bit PCM.")
        if wav.getnchannels() != 1:
            raise ValueError("Audio must be mono.")

        audio = wav.readframes(wav.getnframes())
        duration = wav.getnframes() / SAMPLE_RATE

    audio = audio[:len(audio) - len(audio) % FRAME_BYTES]
    frames = [
        audio[i:i + FRAME_BYTES]
        for i in range(0, len(audio), FRAME_BYTES)
    ]
    return frames, duration


async def main():
    if not AUDIO_PATH.exists():
        raise FileNotFoundError(AUDIO_PATH)

    frames, audio_duration = load_pcm_frames(AUDIO_PATH)

    # 1024 bytes = 512 mono PCM16 samples = 32 ms at 16 kHz.
    frame_interval = FRAME_BYTES / 2 / SAMPLE_RATE
    silence_count = round(TRAILING_SILENCE_SECONDS / frame_interval)
    silence = bytes(FRAME_BYTES)

    transcripts = []
    transcript_events = []
    send_durations = []
    schedule_drifts = []

    test_start = time.perf_counter()
    audio_start = None
    audio_end = None
    first_transcript_at = None

    print(f"Audio duration: {audio_duration:.3f}s")
    print(f"Audio frames: {len(frames)}")
    print(f"Target frame interval: {frame_interval * 1000:.1f}ms")
    print(f"Trailing silence: {TRAILING_SILENCE_SECONDS:.1f}s")
    print("\nConnecting...")

    async with websockets.connect(WS_URL, max_size=2**20) as ws:
        ready = json.loads(await asyncio.wait_for(ws.recv(), timeout=30))
        connected_at = time.perf_counter()
        print("Server ready:", ready)

        if ready.get("type") != "ready":
            raise RuntimeError(f"Unexpected server response: {ready}")

        async def receive_events():
            nonlocal first_transcript_at

            try:
                while True:
                    raw = await ws.recv()
                    received_at = time.perf_counter()
                    event = json.loads(raw)

                    if event.get("type") == "transcript":
                        text = event.get("text", "").strip()
                        if text:
                            if first_transcript_at is None:
                                first_transcript_at = received_at

                            transcripts.append(text)
                            transcript_events.append((received_at, text))

                            print(
                                f"[TRANSCRIPT +"
                                f"{received_at - audio_start:.3f}s] {text}"
                            )

                    elif event.get("type") == "error":
                        print("[SERVER ERROR]", event)

                    else:
                        print("[SERVER EVENT]", event)

            except websockets.ConnectionClosed:
                pass

        receiver = asyncio.create_task(receive_events())

        try:
            print("\nSending frames on a steady schedule...")
            audio_start = time.perf_counter()

            all_frames = frames + [silence] * silence_count
            send_start = time.perf_counter()

            for index, frame in enumerate(all_frames):
                # Schedule against an absolute deadline so send duration
                # doesn't accumulate on top of every 32 ms interval.
                target = send_start + index * frame_interval
                now = time.perf_counter()

                if now < target:
                    await asyncio.sleep(target - now)
                else:
                    schedule_drifts.append(now - target)

                before_send = time.perf_counter()
                await ws.send(frame)
                after_send = time.perf_counter()
                send_durations.append(after_send - before_send)

            audio_end = time.perf_counter()
            print("Finished sending audio and silence.")

            # Wait for the final transcript for observation only.
            await asyncio.sleep(4)

        finally:
            receiver.cancel()
            try:
                await receiver
            except asyncio.CancelledError:
                pass

    test_end = time.perf_counter()

    print("\n" + "=" * 52)
    print("FRAME PACING AND LATENCY RESULTS")
    print("=" * 52)

    actual_send_time = audio_end - audio_start
    expected_send_time = len(all_frames) * frame_interval

    print(f"Connection setup:          {connected_at - test_start:.3f}s")
    print(f"Audio duration:            {audio_duration:.3f}s")
    print(f"Expected send duration:    {expected_send_time:.3f}s")
    print(f"Actual send duration:      {actual_send_time:.3f}s")
    print(f"Total test duration:       {test_end - test_start:.3f}s")

    if send_durations:
        print(
            f"Average WebSocket send:    "
            f"{sum(send_durations) / len(send_durations) * 1000:.3f}ms"
        )
        print(
            f"Maximum WebSocket send:    "
            f"{max(send_durations) * 1000:.3f}ms"
        )

    if schedule_drifts:
        print(
            f"Late frame deadlines:      {len(schedule_drifts)}"
        )
        print(
            f"Maximum schedule drift:    "
            f"{max(schedule_drifts) * 1000:.3f}ms"
        )
    else:
        print("Late frame deadlines:      0")

    if first_transcript_at is not None:
        print(
            f"First transcript from start:"
            f" {first_transcript_at - audio_start:.3f}s"
        )
        print(
            f"First transcript after connect:"
            f" {first_transcript_at - connected_at:.3f}s"
        )
    else:
        print("First transcript:           NOT RECEIVED")

    if transcript_events:
        last_at, _ = transcript_events[-1]
        print(
            f"Last transcript from start: "
            f"{last_at - audio_start:.3f}s"
        )
        print(
            f"Last transcript vs send end: "
            f"{last_at - audio_end:+.3f}s"
        )
        print(f"Transcript segments:        {len(transcript_events)}")
    else:
        print("Transcript segments:        0")

    print("\n--- FINAL TRANSCRIPT ---")
    print(" ".join(transcripts) if transcripts else "(No transcript received)")


if __name__ == "__main__":
    asyncio.run(main())
