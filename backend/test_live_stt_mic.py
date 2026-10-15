
import asyncio
import importlib.util
import json
import time

import websockets


WS_URL = "ws://127.0.0.1:8000/api/stt/stream?language=en"

SAMPLE_RATE = 16000
BLOCK_SIZE = 512                 # 512 samples = 1024 bytes = 32 ms
FRAME_BYTES = 1024
CAPTURE_SECONDS = 12
TRAILING_SILENCE_FRAMES = 32     # Approximately 1 second


if importlib.util.find_spec("sounddevice") is None:
    print("Missing microphone dependency.")
    print("Install it inside your active backend virtual environment:")
    print("pip install sounddevice")
    raise SystemExit(1)

import sounddevice as sd


async def run_test():
    audio_queue = asyncio.Queue()
    stopping = asyncio.Event()
    transcripts = []
    start_time = time.perf_counter()
    last_transcript_time = None
    send_count = 0

    loop = asyncio.get_running_loop()

    def microphone_callback(indata, frames, time_info, status):
        if status:
            print(f"[MIC WARNING] {status}", flush=True)

        audio = bytes(indata)

        if len(audio) == FRAME_BYTES:
            loop.call_soon_threadsafe(audio_queue.put_nowait, audio)
        else:
            print(
                f"[MIC WARNING] Unexpected frame size: {len(audio)} bytes",
                flush=True,
            )

    async def send_microphone_audio(ws):
        nonlocal send_count

        while not stopping.is_set() or not audio_queue.empty():
            try:
                frame = await asyncio.wait_for(
                    audio_queue.get(),
                    timeout=0.1,
                )
            except asyncio.TimeoutError:
                continue

            await ws.send(frame)
            send_count += 1

        return send_count

    async def receive_events(ws):
        nonlocal last_transcript_time

        try:
            async for message in ws:
                try:
                    event = json.loads(message)
                except json.JSONDecodeError:
                    print("[SERVER MESSAGE]", message)
                    continue

                event_type = event.get("type")

                if event_type == "transcript":
                    text = event.get("text", "").strip()

                    if text:
                        transcripts.append(text)
                        last_transcript_time = time.perf_counter()
                        elapsed = last_transcript_time - start_time

                        print(
                            f"\n[TRANSCRIPT +{elapsed:.2f}s] {text}",
                            flush=True,
                        )

                elif event_type == "processing":
                    print(
                        f"[SERVER EVENT] {event.get('event', event)}",
                        flush=True,
                    )

                elif event_type == "error":
                    print(f"[SERVER ERROR] {event}", flush=True)

                else:
                    print(f"[SERVER EVENT] {event}", flush=True)

        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[RECEIVE ERROR] {exc}", flush=True)

    print("=" * 55)
    print("GOLDEN 15 — LIVE MICROPHONE STT TEST")
    print("=" * 55)
    print(f"WebSocket: {WS_URL}")
    print(f"Sample rate: {SAMPLE_RATE} Hz")
    print(f"Frame size: {FRAME_BYTES} bytes")
    print(f"Capture duration: {CAPTURE_SECONDS} seconds")
    print()

    try:
        async with websockets.connect(
            WS_URL,
            max_size=None,
            ping_interval=20,
            ping_timeout=20,
        ) as ws:

            ready_message = await asyncio.wait_for(ws.recv(), timeout=10)
            ready = json.loads(ready_message)

            print("Server response:", ready)

            if ready.get("type") != "ready":
                print("ERROR: Server did not send a ready event.")
                return

            if ready.get("frame_bytes") != FRAME_BYTES:
                print("ERROR: Server frame size does not match.")
                return

            receiver_task = asyncio.create_task(receive_events(ws))
            sender_task = asyncio.create_task(send_microphone_audio(ws))

            try:
                print()
                print("Microphone is opening...")

                with sd.RawInputStream(
                    samplerate=SAMPLE_RATE,
                    blocksize=BLOCK_SIZE,
                    channels=1,
                    dtype="int16",
                    callback=microphone_callback,
                ):
                    print("MICROPHONE LIVE — SPEAK NOW!")
                    print(
                        'Try: "Hello, I want to report a suspicious UPI '
                        'transaction. Five thousand rupees were deducted '
                        'without my permission."'
                    )
                    print()

                    await asyncio.sleep(CAPTURE_SECONDS)

                print("\nMicrophone capture finished.")
                await asyncio.sleep(0.1)

                stopping.set()
                await asyncio.wait_for(sender_task, timeout=5)

                print("Sending trailing silence to finalize transcription...")

                silence_frame = bytes(FRAME_BYTES)

                for _ in range(TRAILING_SILENCE_FRAMES):
                    await ws.send(silence_frame)
                    await asyncio.sleep(0.032)

                print("Waiting for final transcript events...")

                deadline = time.perf_counter() + 6

                while time.perf_counter() < deadline:
                    await asyncio.sleep(0.1)

                    if (
                        transcripts
                        and last_transcript_time is not None
                        and time.perf_counter() - last_transcript_time >= 2
                    ):
                        break

                print("\n" + "=" * 55)
                print("LIVE MICROPHONE TEST RESULTS")
                print("=" * 55)
                print(f"Microphone capture: {CAPTURE_SECONDS} seconds")
                print(f"Audio frames sent: {send_count}")
                print(f"Transcript segments: {len(transcripts)}")

                if transcripts:
                    print("\nFINAL TRANSCRIPT:")
                    print(" ".join(transcripts))
                else:
                    print("\nNO TRANSCRIPT RECEIVED.")
                    print("Check the backend logs for provider or audio errors.")

            finally:
                stopping.set()

                if not sender_task.done():
                    sender_task.cancel()

                if not receiver_task.done():
                    receiver_task.cancel()

                await asyncio.gather(
                    sender_task,
                    receiver_task,
                    return_exceptions=True,
                )

    except Exception as exc:
        print(f"\nTEST FAILED: {type(exc).__name__}: {exc}")
        print("Check that the backend is running and the microphone is available.")


if __name__ == "__main__":
    asyncio.run(run_test())
