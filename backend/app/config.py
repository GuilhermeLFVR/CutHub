import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / "backend" / ".env"

load_dotenv(ENV_PATH)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_BOT_NAME = os.getenv("TELEGRAM_BOT_NAME", "CutHub Bot")

#sempre existe, mesmo sem .env
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8000,http://localhost:8000",
).split(",")
