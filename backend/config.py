import os
from dotenv import load_dotenv

load_dotenv()

GNANI_API_KEY = os.getenv("GNANI_API_KEY", "")
APP_NAME = "Golden 15"
APP_VERSION = "0.1.0"

SUPPORTED_LANGUAGES = {
    "en": "English",
    "hi": "Hindi",
    "hinglish": "Hinglish",
}
