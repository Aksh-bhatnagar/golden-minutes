import asyncio
from datetime import date, timedelta
from time import perf_counter

from app.models.report import FraudReport
from app.services.conversation import process_conversation_answer


def D(n: int) -> str:
    return (date.today() - timedelta(days=n)).isoformat()


SKIP = {"en": "I don't know", "hi": "मुझे नहीं पता", "hinglish": "mujhe nahi pata"}

# "*" = any non-empty value, "~x" = starts with x, floats allow rounding.
SCENARIOS = [
    {"name": "en-1", "lang": "en", "answers": {
        "fraud_type": "Someone called pretending to be from my bank and money was deducted",
        "bank_or_payment_app": "PhonePe", "amount_inr": "fifty thousand rupees",
        "transaction_reference": "4 0 1 2 3 4 5 6 7 8 9 0",
        "incident_date": "yesterday", "incident_time": "around 5 pm",
        "registered_phone_last4": "5 6 7 8", "otp_or_pin_shared": "no",
        "contacted_bank": "yes", "caller_name": "my name is Rahul Sharma"},
     "expect": {"fraud_type": "*", "bank_or_payment_app": "PhonePe", "amount_inr": 50000.0,
                "transaction_reference": "401234567890", "incident_date": D(1),
                "incident_time": "17:00", "registered_phone_last4": "5678",
                "otp_or_pin_shared": "no", "contacted_bank": "yes", "caller_name": "~Rahul"}},
    {"name": "en-2", "lang": "en", "answers": {
        "fraud_type": "I clicked a link on WhatsApp and money was taken from my Google Pay",
        "bank_or_payment_app": "Google Pay", "amount_inr": "1,20,000",
        "transaction_reference": "5 6 7 8 9 0 1 2 3 4 5 6",
        "incident_date": "the day before yesterday", "incident_time": "at 11:30 at night",
        "registered_phone_last4": "3 2 1 0", "otp_or_pin_shared": "yes I did",
        "contacted_bank": "not yet", "caller_name": "I am Aman Gupta"},
     "expect": {"fraud_type": "*", "bank_or_payment_app": "Google Pay", "amount_inr": 120000.0,
                "transaction_reference": "567890123456", "incident_date": D(2),
                "incident_time": "23:30", "registered_phone_last4": "3210",
                "otp_or_pin_shared": "yes", "contacted_bank": "no", "caller_name": "~Aman"}},
    {"name": "hi-1", "lang": "hi", "answers": {
        "fraud_type": "मेरे बैंक खाते से किसी ने पैसे निकाल लिए",
        "bank_or_payment_app": "फोन पे", "amount_inr": "दो लाख रुपये",
        "transaction_reference": "456789101234", "incident_date": "कल",
        "incident_time": "शाम को साढ़े चार बजे", "registered_phone_last4": "9424",
        "otp_or_pin_shared": "नहीं", "contacted_bank": "हाँ",
        "caller_name": "मेरा नाम प्रिया वर्मा है"},
     "expect": {"fraud_type": "*", "bank_or_payment_app": "PhonePe", "amount_inr": 200000.0,
                "transaction_reference": "456789101234", "incident_date": D(1),
                "incident_time": "16:30", "registered_phone_last4": "9424",
                "otp_or_pin_shared": "no", "contacted_bank": "yes", "caller_name": "~Priya"}},
    {"name": "hi-2", "lang": "hi", "answers": {
        "fraud_type": "एक लिंक पर क्लिक करने के बाद मेरे अकाउंट से पैसे कट गए",
        "bank_or_payment_app": "पेटीएम", "amount_inr": "पचास हज़ार",
        "transaction_reference": "123456789012", "incident_date": "परसों",
        "incident_time": "सुबह नौ बजे", "registered_phone_last4": "7 7 0 1",
        "otp_or_pin_shared": "हाँ", "contacted_bank": "नहीं",
        "caller_name": "मैं अमित हूँ"},
     "expect": {"fraud_type": "*", "bank_or_payment_app": "Paytm", "amount_inr": 50000.0,
                "transaction_reference": "123456789012", "incident_date": D(2),
                "incident_time": "09:00", "registered_phone_last4": "7701",
                "otp_or_pin_shared": "yes", "contacted_bank": "no", "caller_name": "~Amit"}},
    {"name": "hing-1", "lang": "hinglish", "answers": {
        "fraud_type": "mere bank se paise chale gaye", "bank_or_payment_app": "sbi bank se gaye",
        "amount_inr": "5,00,000 rupees", "transaction_reference": "transaction id hai 12345678910",
        "incident_date": "kal hua tha", "incident_time": "shaam ko saade chaar baje",
        "registered_phone_last4": "9424", "otp_or_pin_shared": "nahi",
        "contacted_bank": "haan bata diya", "caller_name": "mera naam rahul hai"},
     "expect": {"fraud_type": "*", "bank_or_payment_app": "State Bank of India (SBI)",
                "amount_inr": 500000.0, "transaction_reference": "12345678910",
                "incident_date": D(1), "incident_time": "16:30",
                "registered_phone_last4": "9424", "otp_or_pin_shared": "no",
                "contacted_bank": "yes", "caller_name": "~Rahul"}},
    {"name": "hing-2", "lang": "hinglish", "answers": {
        "fraud_type": "kisi ne call karke mera paisa nikal liya", "bank_or_payment_app": "paytm",
        "amount_inr": "dedh lakh", "transaction_reference": "9 8 7 6 5 4 3 2 1 0 9 8",
        "incident_date": "parso", "incident_time": "subah dus baje",
        "registered_phone_last4": "1 2 3 4", "otp_or_pin_shared": "haan maine otp bata diya tha",
        "contacted_bank": "nahi abhi tak nahi", "caller_name": "main priya hoon"},
     "expect": {"fraud_type": "*", "bank_or_payment_app": "Paytm", "amount_inr": 150000.0,
                "transaction_reference": "987654321098", "incident_date": D(2),
                "incident_time": "10:00", "registered_phone_last4": "1234",
                "otp_or_pin_shared": "yes", "contacted_bank": "no", "caller_name": "~Priya"}},
]


def matches(got, want) -> bool:
    if want == "*":
        return bool(got)
    if isinstance(want, float):
        return got is not None and abs(float(got) - want) < 1
    if isinstance(want, str) and want.startswith("~"):
        return isinstance(got, str) and got.lower().startswith(want[1:].lower())
    return got == want


async def run(scenario):
    report, current, history = FraudReport(), "fraud_type", []
    lang, times, turns = scenario["lang"], [], 0
    result = None

    while current and turns < 20:
        said = scenario["answers"].get(current, SKIP[lang])

        for attempt in range(2):
            started = perf_counter()
            try:
                result = await process_conversation_answer(
                    report=report, transcript=said, current_field=current,
                    language=lang, conversation_history=history[-4:],
                )
                break
            except RuntimeError:
                await asyncio.sleep(20)  # rate limit: wait and retry once
        else:
            raise RuntimeError("model unavailable")

        times.append(perf_counter() - started)
        turns += 1
        asked = current
        report, current = result["report"], result["current_field"]
        history += [{"role": "user", "content": said},
                    {"role": "assistant", "content": result["response"]}]

        print(f"  [{scenario['name']}] t{turns} asked={asked} "
              f"action={result['action']} next={current} "
              f"path={result.get('path')} model={result.get('model')}")

        if result["action"] in ("confirm", "handoff"):
            break

        await asyncio.sleep(1.5)  # pace requests to avoid 429s

    return report, turns, times


async def main():
    ok = total = perfect = 0
    all_turns, all_times, misses = [], [], []

    for s in SCENARIOS:
        report, turns, times = await run(s)
        data = report.model_dump()
        right = [f for f, w in s["expect"].items() if matches(data.get(f), w)]
        ok, total = ok + len(right), total + len(s["expect"])
        perfect += len(right) == len(s["expect"])
        all_turns.append(turns)
        all_times += times
        for f, w in s["expect"].items():
            if f not in right:
                misses.append(f"{s['name']}: {f} wanted {w!r}, got {data.get(f)!r}")
        print(f"{s['name']}: {len(right)}/{len(s['expect'])} fields, {turns} turns")

    all_times.sort()
    pick = lambda q: all_times[round(q * (len(all_times) - 1))]

    print(f"\nScenarios: {len(SCENARIOS)}")
    print(f"Field accuracy: {100 * ok / total:.1f}% ({ok}/{total})")
    print(f"Fully correct reports: {perfect}/{len(SCENARIOS)}")
    print(f"Turns per report: avg {sum(all_turns) / len(all_turns):.1f}")
    print(f"Backend turn time: p50 {pick(0.5):.2f}s  p95 {pick(0.95):.2f}s")
    print("\nMisses:\n" + "\n".join(misses or ["none"]))


asyncio.run(main())