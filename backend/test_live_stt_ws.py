
import asyncio
import json
import websockets


async def main():
    url = "ws://127.0.0.1:8000/api/stt/stream?language=en"

    print("Connecting to Golden 15 WebSocket...")

    try:
        async with websockets.connect(url) as ws:
            message = await asyncio.wait_for(ws.recv(), timeout=30)
            result = json.loads(message)

            print("Server response:")
            print(json.dumps(result, indent=2))

            if result.get("type") == "ready":
                print("\nSUCCESS: WebSocket is ready for audio.")
            else:
                print("\nThe server did not return a ready event.")

    except Exception as exc:
        print(f"\nFAILED: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
