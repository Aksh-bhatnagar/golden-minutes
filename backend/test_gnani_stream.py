
import asyncio
import io
import wave
from pathlib import Path

from dotenv import load_dotenv

from gnani.tts import GnaniTTSClient

load_dotenv()

OUTPUT_DIR = Path(__file__).parent / "test_audio"
OUTPUT_DIR.mkdir(exist_ok=True)

TEST_CASES = [
    {
        "name": "hindi",
        "language": "hi-IN",
        "text": (
            "Namaste, mera naam Rahul hai. "
            "Mere bank account se paanch hazaar rupaye kat gaye hain. "
            "Mujhe is fraud ki report karne mein madad chahiye."
        ),
    },
    {
        "name": "hinglish",
        "language": "hi-IN",
        "text": (
            "Hello, mere account se five thousand rupees deduct ho gaye. "
            "Maine koi transaction approve nahi kiya tha. "
            "Please meri help kijiye."
        ),
    },
]


async def main():
    client = GnaniTTSClient(
        voice="Kaveri",
        model="timbre-v2.5",
        output_format="wav",
    )

    for case in TEST_CASES:
        print(f"\nGenerating {case['name']} audio...")
        print("Text:", case["text"])

        try:
            # The exact method and arguments depend on your installed
            # gnani-vachana SDK version and backend TTS service.
            result = await client.synthesize(
                text=case["text"],
                language=case["language"],
            )

            if isinstance(result, bytes):
                audio_bytes = result
            elif hasattr(result, "content"):
                audio_bytes = result.content
            else:
                raise TypeError(
                    f"Unexpected TTS result type: {type(result).__name__}"
                )

            output_path = OUTPUT_DIR / f"{case['name']}.wav"
            output_path.write_bytes(audio_bytes)

            # Validate that the returned file is a readable WAV.
            with wave.open(io.BytesIO(audio_bytes), "rb") as wav:
                print("Channels:", wav.getnchannels())
                print("Sample rate:", wav.getframerate())
                print("Duration:", round(
                    wav.getnframes() / wav.getframerate(), 2
                ), "seconds")

            print("Saved:", output_path)

        except Exception as exc:
            print(f"FAILED: {type(exc).__name__}: {exc}")


if __name__ == "__main__":
    asyncio.run(main())
