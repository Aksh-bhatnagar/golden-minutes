"""
Golden Minutes fixes. Run from your project folder (the one that contains
backend/ and frontend/):

    python apply_fixes.py            # apply
    python apply_fixes.py --check    # only verify every edit would work

Nothing is written unless EVERY edit matches. Originals are saved as .bak.
"""
import sys
from pathlib import Path

CHECK_ONLY = "--check" in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith("--")]
ROOT = Path(args[0]).resolve() if args else Path.cwd()
HERE = Path(__file__).resolve().parent
SKIP = {"venv", ".venv", "node_modules", "__pycache__", ".git", "dist", "build"}


OWN_FILES = {HERE / "apply_fixes.py", HERE / "conversation.py", HERE / "index.css"}


def find(pattern, contains=None):
    hits = []
    for p in ROOT.rglob(pattern):
        if SKIP & set(p.parts) or not p.is_file():
            continue
        if p.resolve() in OWN_FILES or (HERE != ROOT and HERE in p.resolve().parents):
            continue  # never match this fix folder itself
        if contains and contains not in p.read_text(encoding="utf-8", errors="ignore"):
            continue
        hits.append(p)
    if len(hits) != 1:
        raise SystemExit(f"Expected exactly one {pattern!r}"
                         f"{' containing ' + repr(contains) if contains else ''}, found {len(hits)}: {hits}")
    return hits[0]


class EditError(Exception):
    pass


def replace(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise EditError(f"{label}: anchor found {n} times (need 1):\n{old[:120]!r}")
    return text.replace(old, new)


def between(text, start, end, new, label):
    if text.count(start) != 1:
        raise EditError(f"{label}: start marker found {text.count(start)} times: {start[:80]!r}")
    i = text.index(start)
    if end not in text[i:]:
        raise EditError(f"{label}: end marker not found after start: {end[:80]!r}")
    j = text.index(end, i)
    return text[:i] + new + text[j:]


# ---------------------------------------------------------------- new text
OPENINGS = '''OPENINGS = {
    "en": (
        "Hi, this is Golden Minutes, an AI helper, not the police or a bank. "
        "I'm sorry this happened. Tell me what happened, in your own words."
    ),
    "hi": (
        "नमस्ते, यह Golden Minutes है, एक AI सहायक, पुलिस या बैंक नहीं। "
        "मुझे अफ़सोस है कि ऐसा हुआ। आप आराम से बताइए, क्या हुआ?"
    ),
    "hinglish": (
        "नमस्ते, यह Golden Minutes है, एक AI assistant, police या bank नहीं। "
        "मुझे अफ़सोस है कि ऐसा हुआ। आप आराम से बताइए, क्या हुआ?"
    ),
    "bn": "নমস্কার, আমি Golden Minutes, একটি AI সহকারী। আমি পুলিশ বা ব্যাংক নই। কী হয়েছে, ধীরে ধীরে বলুন।",
    "gu": "નમસ્તે, હું Golden Minutes છું, એક AI સહાયક. હું પોલીસ કે બેંક નથી. શું થયું, શાંતિથી જણાવો.",
    "kn": "ನಮಸ್ಕಾರ, ನಾನು Golden Minutes, ಒಂದು AI ಸಹಾಯಕ. ನಾನು ಪೊಲೀಸ್ ಅಥವಾ ಬ್ಯಾಂಕ್ ಅಲ್ಲ. ಏನಾಯಿತು ಎಂದು ನಿಧಾನವಾಗಿ ಹೇಳಿ.",
    "ml": "നമസ്കാരം, ഞാൻ Golden Minutes, ഒരു AI സഹായി. ഞാൻ പോലീസോ ബാങ്കോ അല്ല. എന്താണ് സംഭവിച്ചതെന്ന് പതുക്കെ പറയൂ.",
    "mr": "नमस्कार, मी Golden Minutes, एक AI सहाय्यक. मी पोलीस किंवा बँक नाही. काय झालं ते शांतपणे सांगा.",
    "pa": "ਸਤ ਸ੍ਰੀ ਅਕਾਲ, ਮੈਂ Golden Minutes ਹਾਂ, ਇੱਕ AI ਸਹਾਇਕ। ਮੈਂ ਪੁਲਿਸ ਜਾਂ ਬੈਂਕ ਨਹੀਂ ਹਾਂ। ਕੀ ਹੋਇਆ, ਆਰਾਮ ਨਾਲ ਦੱਸੋ।",
    "ta": "வணக்கம், நான் Golden Minutes, ஒரு AI உதவியாளர். நான் காவல்துறையோ வங்கியோ அல்ல. என்ன நடந்தது என்று நிதானமாகச் சொல்லுங்கள்.",
    "te": "నమస్కారం, నేను Golden Minutes, ఒక AI సహాయకురాలిని. నేను పోలీసు లేదా బ్యాంకు కాదు. ఏమి జరిగిందో నెమ్మదిగా చెప్పండి.",
}


'''

HANDOFF = '''HANDOFF = {
    "en": "I can't help further here. Please call 1930 for the official helpline.",
    "hi": "मैं यहाँ इससे आगे मदद नहीं कर सकती। कृपया आधिकारिक हेल्पलाइन 1930 पर कॉल कीजिए।",
    "hinglish": "मैं यहाँ इससे आगे मदद नहीं कर सकती। कृपया official helpline 1930 पर call कीजिए।",
}

'''

WRAPUP = '''WRAPUP = {
    "en": "That's everything I need. I'll show your details on screen now, so you can check and correct them.",
    "hi": "मुझे जो चाहिए था, वह सब मिल गया है। अब मैं आपकी जानकारी स्क्रीन पर दिखा रही हूँ, आप उसे जाँचकर सुधार सकते हैं।",
    "hinglish": "मुझे जो चाहिए था, वह सब मिल गया है। अब मैं आपके details screen पर दिखा रही हूँ, आप check करके correct कर सकते हैं।",
}

'''

ALERT = '''ALERT = {
    "danger": {
        "en": "If you are in immediate danger, please call 112 right now.",
        "hi": "अगर आप तुरंत ख़तरे में हैं तो अभी 112 पर कॉल कीजिए।",
        "hinglish": "अगर आप तुरंत danger में हैं तो अभी 112 पर call कीजिए।",
    },
    "no_money_lost": {
        "en": "This assistant is only for money lost to online fraud. For other cybercrime, please visit cybercrime.gov.in.",
        "hi": "यह असिस्टेंट सिर्फ़ ऑनलाइन धोखाधड़ी में गए पैसों के लिए है। दूसरे साइबर अपराध के लिए कृपया cybercrime.gov.in देखिए।",
        "hinglish": "यह assistant सिर्फ़ online fraud में गए पैसों के लिए है। दूसरे cybercrime के लिए कृपया cybercrime.gov.in देखिए।",
    },
}


'''

TS_CONSTANTS = '''const SILENCE_SENTENCE_END_MS = 600;
const SILENCE_DEFAULT_MS = 900;
const SILENCE_INCOMPLETE_MS = 1900;
const SILENCE_DIGITS_MS = 2000;
const SILENCE_SHORT_ANSWER_MS = 450; // a bare yes / no / skip is already complete
const SILENCE_AMOUNT_WAIT_MS = 2200; // "it was around ..." and the number is still coming
const SILENCE_AMOUNT_DONE_MS = 1200; // the amount has digits or a word like lakh
const SILENCE_PHONE_DONE_MS = 600; // four digits heard
const SILENCE_REF_DONE_MS = 1200; // twelve or more digits heard'''

TS_PATTERNS = r'''const INCOMPLETE_END =
  /(?:\b(?:and|but|so|because|then|also|um+|uh+|like|aur|lekin|toh|phir|matlab|ki|ya|woh|wo|mera|meri|around|about|roughly|approximately|nearly|almost|is|was|are|were|the|of|to|a|an|at|for|with|my|lagbhag|kareeb)\b|[,:;\-–…])\s*$/i;
const INCOMPLETE_END_DEVANAGARI =
  /(?:^|\s)(?:और|लेकिन|तो|फिर|मतलब|कि|या|वो|मेरा|मेरी|लगभग|करीब)\s*$/u;
const SHORT_ANSWER =
  /^[^\p{L}\p{M}\p{N}]*(?:yes|yeah|yep|no|nope|haan|han|haa|ji|nahi|nahin|skip|हाँ|हां|हा|जी|नहीं|नही|ना|छोड़िए|छोड़ो)[^\p{L}\p{M}\p{N}]*$/iu;
const NUMBER_WORD =
  /\d|\b(?:lakh|lakhs|lac|lacs|hazaar|hazar|thousand|crore|hundred|sau)\b|लाख|हज़ार|हजार|करोड़|सौ/iu;
const DIGIT_FIELDS = new Set(["transaction_reference", "registered_phone_last4"]);

'''

TS_FUNCTION = r'''function silenceDelayFor(text: string, field: string | null): number {
  const t = text.trim();
  if (INCOMPLETE_END.test(t) || INCOMPLETE_END_DEVANAGARI.test(t)) {
    return SILENCE_INCOMPLETE_MS;
  }

  // A bare yes / no / skip is a complete answer.
  if (SHORT_ANSWER.test(t)) return SILENCE_SHORT_ANSWER_MS;

  if (field === "amount_inr") {
    return NUMBER_WORD.test(t) ? SILENCE_AMOUNT_DONE_MS : SILENCE_AMOUNT_WAIT_MS;
  }

  if (field && DIGIT_FIELDS.has(field) && /\d\s*$/.test(t)) {
    const count = (t.match(/\d/g) ?? []).length;
    if (field === "registered_phone_last4" && count >= 4) return SILENCE_PHONE_DONE_MS;
    if (field === "transaction_reference" && count >= 12) return SILENCE_REF_DONE_MS;
    return SILENCE_DIGITS_MS;
  }

  if (/[.?!।]$/.test(t)) return SILENCE_SENTENCE_END_MS;
  return SILENCE_DEFAULT_MS;
}

'''

# ---------------------------------------------------------------- edits
def edit_routes(t):
    return between(t, "OPENINGS = {", "class NextQuestionRequest(BaseModel):", OPENINGS, "routes OPENINGS")


def edit_questions(t):
    t = between(t, "HANDOFF = {", "SORRY = {", HANDOFF, "questions HANDOFF")
    t = between(t, "WRAPUP = {", "ALERT = {", WRAPUP, "questions WRAPUP")
    t = between(t, "ALERT = {", "def pick(", ALERT, "questions ALERT")
    return t


def edit_llm(t):
    t = replace(
        t,
        "You are the language engine of Golden Minutes, a cybercrime helpline desk\n"
        "assistant in India (a warm, calm woman). A caller reports money lost to online\n"
        "fraud. Read caller_said",
        "You are the language engine of Golden Minutes, an AI assistant (a warm, calm\n"
        "woman's voice) that helps people in India note down details after online fraud.\n"
        "It is not the police, a bank or the official helpline. A caller reports money\n"
        "lost to online fraud. Read caller_said",
        "llm identity",
    )
    t = replace(
        t,
        '- amount_inr: number of rupees ("दो लाख", "two lakh", "1,00,000" -> 200000 etc).',
        '- amount_inr: number of rupees ("दो लाख", "two lakh", "1,00,000" -> 200000 etc).\n'
        "  If the caller gives a range or an unclear number, use null.",
        "llm amount",
    )
    t = replace(
        t,
        "  last Monday; if no year is given use today's year. null if unclear.",
        "  last Monday; if no year is given use today's year. Spoken years such as\n"
        '  "do hazaar chhabbis" mean 2026. null if unclear.',
        "llm date",
    )
    t = replace(t, "completion = await _call(400)", "completion = await _call(700)", "llm budget 1")
    t = replace(t, "completion = await _call(900)", "completion = await _call(1200)", "llm budget 2")
    return t


def edit_parsers(t):
    return replace(
        t,
        '    m = re.search(r"\\d+(?:\\.\\d+)?", t)\n    if not m:\n        return None\n',
        '    # "4 se 5", "5 to 6": a range is not one amount, let the model or the review screen decide.\n'
        '    if re.search(r"\\d\\s*(?:से|to|या|ya|or|-|–)\\s*\\d", t):\n'
        "        return None\n\n"
        '    m = re.search(r"\\d+(?:\\.\\d+)?", t)\n    if not m:\n        return None\n',
        "parsers range guard",
    )


def edit_hook(t):
    t = replace(
        t,
        "const SILENCE_SENTENCE_END_MS = 700;\n"
        "const SILENCE_DEFAULT_MS = 1000;\n"
        "const SILENCE_INCOMPLETE_MS = 1900;\n"
        "const SILENCE_DIGITS_MS = 2000;",
        TS_CONSTANTS,
        "hook constants",
    )
    t = between(t, "const INCOMPLETE_END =", "let lastSpeechAt = 0;", TS_PATTERNS, "hook patterns")
    t = between(t, "function silenceDelayFor(", "interface OpeningQuestion {", TS_FUNCTION, "hook silenceDelayFor")
    return t


def copy_file(src_name):
    def f(_old):
        return (HERE / src_name).read_text(encoding="utf-8")
    return f


# ---------------------------------------------------------------- run
targets = [
    (find("*.py", contains="OPENINGS = {"), edit_routes),
    (find("questions.py"), edit_questions),
    (find("llm.py"), edit_llm),
    (find("parsers.py"), edit_parsers),
    (find("useVoiceSession.ts"), edit_hook),
    (find("conversation.py"), copy_file("conversation.py")),
    (find("index.css"), copy_file("index.css")),
]

results, errors = [], []
for path, fn in targets:
    raw = path.read_bytes().decode("utf-8")
    crlf = "\r\n" in raw
    try:
        new = fn(raw.replace("\r\n", "\n"))
    except EditError as exc:
        errors.append(f"{path.relative_to(ROOT)}\n    {exc}")
        continue
    results.append((path, new.replace("\n", "\r\n") if crlf else new))

if errors:
    print("NOTHING WAS CHANGED. These edits did not match your files:\n")
    print("\n".join(errors))
    print("\nSend me the lines above and the file, and I will adjust the anchor.")
    sys.exit(1)

for path, new in results:
    print(("would update  " if CHECK_ONLY else "updated  ") + str(path.relative_to(ROOT)))
    if not CHECK_ONLY:
        backup = path.with_suffix(path.suffix + ".bak")
        if not backup.exists():
            backup.write_bytes(path.read_bytes())
        path.write_bytes(new.encode("utf-8"))

print("\nAll edits verified." if CHECK_ONLY else "\nDone. Originals saved as .bak next to each file.")