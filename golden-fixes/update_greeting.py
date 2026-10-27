import sys
from pathlib import Path

CHECK_ONLY = "--check" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
ROOT = Path(args[0]).resolve() if args else Path.cwd()
HERE = Path(__file__).resolve().parent
SKIP = {"venv", ".venv", "node_modules", "__pycache__", ".git", "dist", "build"}

NEW = '''OPENINGS = {
    "en": (
        "Hi, I'm an AI cyber crime helper. "
        "I'm sorry this happened. Tell me what happened, in your own words."
    ),
    "hi": (
        "नमस्ते, मैं एक AI साइबर क्राइम सहायक हूँ। "
        "मुझे अफ़सोस है कि ऐसा हुआ। आप आराम से बताइए, क्या हुआ?"
    ),
    "hinglish": (
        "नमस्ते, मैं एक AI cyber crime helper हूँ। "
        "मुझे अफ़सोस है कि ऐसा हुआ। आप आराम से बताइए, क्या हुआ?"
    ),
    "bn": "নমস্কার, আমি একটি AI সাইবার ক্রাইম সহকারী। কী হয়েছে, ধীরে ধীরে বলুন।",
    "gu": "નમસ્તે, હું એક AI સાયબર ક્રાઇમ સહાયક છું. શું થયું, શાંતિથી જણાવો.",
    "kn": "ನಮಸ್ಕಾರ, ನಾನು ಒಂದು AI ಸೈಬರ್ ಕ್ರೈಂ ಸಹಾಯಕ. ಏನಾಯಿತು ಎಂದು ನಿಧಾನವಾಗಿ ಹೇಳಿ.",
    "ml": "നമസ്കാരം, ഞാൻ ഒരു AI സൈബർ ക്രൈം സഹായിയാണ്. എന്താണ് സംഭവിച്ചതെന്ന് പതുക്കെ പറയൂ.",
    "mr": "नमस्कार, मी एक AI सायबर क्राइम सहाय्यक आहे. काय झालं ते शांतपणे सांगा.",
    "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ ਇੱਕ AI ਸਾਈਬਰ ਕ੍ਰਾਈਮ ਸਹਾਇਕ ਹਾਂ। ਕੀ ਹੋਇਆ, ਆਰਾਮ ਨਾਲ ਦੱਸੋ।",
    "ta": "வணக்கம், நான் ஒரு AI சைபர் கிரைம் உதவியாளர். என்ன நடந்தது என்று நிதானமாகச் சொல்லுங்கள்.",
    "te": "నమస్కారం, నేను ఒక AI సైబర్ క్రైమ్ సహాయకురాలిని. ఏమి జరిగిందో నెమ్మదిగా చెప్పండి.",
}


'''

START, END = "OPENINGS = {", "class NextQuestionRequest(BaseModel):"

hits = []
for p in ROOT.rglob("*.py"):
    if SKIP & set(p.parts) or p.resolve() == Path(__file__).resolve():
        continue
    if p.resolve().parent == HERE or (HERE != ROOT and HERE in p.resolve().parents):
        continue  # never match the fix folder itself
    if START in p.read_text(encoding="utf-8", errors="ignore"):
        hits.append(p)

if len(hits) != 1:
    raise SystemExit(f"Expected one file containing {START!r}, found {len(hits)}: {hits}")

path = hits[0]
raw = path.read_bytes().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")

if text.count(START) != 1 or END not in text:
    raise SystemExit("Could not find the OPENINGS block markers. Nothing was changed.")

i = text.index(START)
j = text.index(END, i)
new = text[:i] + NEW + text[j:]
if crlf:
    new = new.replace("\n", "\r\n")

if CHECK_ONLY:
    print(f"would update {path.relative_to(ROOT)}")
else:
    backup = path.with_name(path.name + ".pre-greeting.bak")
    if not backup.exists():
        backup.write_bytes(raw.encode("utf-8"))
    path.write_bytes(new.encode("utf-8"))
    print(f"updated {path.relative_to(ROOT)}")