# Golden Minutes

**A multilingual, interruptible voice assistant that takes cyber-fraud reports by voice and hands the 1930 helpline a ready PDF.**

---

## The Problem

Victims of online financial fraud in India call the **1930 cyber-crime helpline**, where a human operator asks the same structured questions every time: what happened, how much was lost, when, which bank, whether the bank was contacted, and so on. This takes a lot of manpower, and panicking victims often forget details at the moment speed matters most. Reporting in the first minutes gives investigators the best chance of stopping the money, hence *Golden Minutes*.

## The Solution

Golden Minutes **replaces the human intake step**. The victim talks to a voice assistant in their own language (Hinglish by default). The assistant asks short, focused questions, extracts the key incident details, lets the user review and confirm them, then **generates a PDF report** for the person who handles the case. Investigation stays with humans; only the repetitive intake is automated.

## Key Features

- **Hinglish-first voice conversation** with Hindi and English support
- **Interruptible real-time voice pipeline**: the user can talk over the assistant, and in-flight work is stopped using asynchronous task cancellation
- **Code-driven dialogue flow**: a deterministic controller decides what to ask next, and a slim LLM extractor only pulls structured values out of the user's speech
- **Focused conversations** that collect only what a report needs
- **Normalised values**: amount, date and time are stored in fixed formats
- **Live captions** so the user can see what was understood
- **Review and consent step** before anything is saved
- **PDF report generation** and a **handler page** for the case handler
- **Evaluation harness** that scores extraction accuracy and latency

## How It Works

```
User speech -> Gnani STT -> Dialogue controller (code) -> Groq LLM extractor
                                   |                              |
                                   v                              v
                         next question chosen          structured field values
                                   |
                                   v
                              Gnani TTS -> audio to user
                                   |
       all fields filled -> review & confirm -> PDF report -> handler page
```

If the user interrupts while the assistant is speaking, the running TTS and LLM tasks are cancelled and the assistant switches to listening.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| LLM | Groq `openai/gpt-oss-20b`, with fallback to `gpt-oss-120b` on rate limits (HTTP 429) |
| Speech | Gnani STT and TTS |
| Frontend | React, Vite, Tailwind CSS |

## Getting Started

### Prerequisites

- Python 3.10
- Node.js 18+
- A Groq API key
- Gnani API credentials for STT and TTS

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then add your keys
uvicorn main:app --reload       # TODO: confirm entry point
```

### Environment Variables

```
GROQ_API_KEY=your_key_here
# TODO: add your Gnani variable names, for example:
# GNANI_API_KEY=...
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (usually `http://localhost:5173`).

## Evaluation

`eval_extraction.py` runs 6 synthetic scenarios (English, Hindi, Hinglish), each with 10 ground-truth fields (60 fields in total), through the real conversation logic.

| Metric | First baseline | After fixes |
|---|---|---|
| Field accuracy | 65.0% (39/60) | **96.7% (58/60)** |
| Scenarios fully correct | 2 / 6 | 4 / 6 |
| Avg turns per conversation | 6.5 | 9.5 |
| Backend turn time p50 | 0.76 s | 0.84 s |
| Backend turn time p95 | 4.11 s | 2.08 s |

The main gain came from fixing early-exit and skip bugs in the dialogue logic, where two conversations ended after one turn. Average turns rose because conversations no longer quit before collecting every field.

```bash
python eval_extraction.py
```

**Limitations:** the eval is small (6 scenarios), synthetic (text rather than real audio) and measures extraction and dialogue only. Latency is backend turn time, not end-to-end voice latency. Remaining errors: one case of the LLM guessing a field before it was asked, and one bank-name casing issue.

## Design Decisions

- **Code controls the conversation, the LLM only extracts.** My first LLM-driven version drifted, asked redundant questions and was hard to test. A deterministic controller made the flow short, predictable and measurable.
- **Groq over a local LLM.** Low latency is the whole point of a voice product.
- **No personal name for the assistant.** It introduces itself as an AI helper from Golden Minutes that is not the police or a bank, to avoid misleading users.

## Limitations and Roadmap

- Evaluate with real voice recordings (WER, accents, noise) and a larger scenario set
- Telephony integration (SIP/PSTN) so it can answer real calls
- Stronger privacy and security: encryption, retention limits, authentication on the handler page
- More Indian languages
- Fallback providers for LLM and speech outages

## Disclaimer

This is a prototype built for a challenge. It is not an official product of the 1930 helpline, the police or any bank. In an emergency, call **1930** and contact your bank immediately.

## Acknowledgements

- [Gnani.ai](https://www.gnani.ai) for speech APIs
- [Groq](https://groq.com) for fast LLM inference

## Author

aksh bhatnagar & rishika rajput

