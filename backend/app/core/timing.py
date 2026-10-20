from datetime import datetime


def log(tag: str, message: str) -> None:
    stamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"{stamp} [{tag}] {message}", flush=True)