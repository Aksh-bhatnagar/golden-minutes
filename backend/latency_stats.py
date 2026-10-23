import re
import sys

text = open(sys.argv[1], encoding="utf-8").read()
vals = sorted(
    int(m) for m in re.findall(
        r"\[UI\] audio playing \(\+(\d+)ms after last speech\)", text
    )
)

def pct(q):
    return vals[round(q * (len(vals) - 1))] / 1000

print(f"turns measured: {len(vals)}")
print(f"p50: {pct(0.50):.2f} s   p95: {pct(0.95):.2f} s   max: {vals[-1] / 1000:.2f} s")