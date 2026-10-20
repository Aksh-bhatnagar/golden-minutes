import sys
import wave

import sounddevice as sd

SR = 16000
SECONDS = 8
name = sys.argv[1] if len(sys.argv) > 1 else "hinglish.wav"

print(f"Recording {SECONDS}s. Get ready...")
sd.sleep(2000)
print("GO - speak now")

audio = sd.rec(int(SECONDS * SR), samplerate=SR, channels=1, dtype="int16")
sd.wait()

with wave.open(name, "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(audio.tobytes())

print("Saved", name)