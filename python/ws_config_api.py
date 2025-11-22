from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

# CORS 有効化（Next.js からアクセスするため）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ws_config")
def ws_config():
    return {
        "WS_URL_A": os.getenv("WS_URL_A"),
        "WS_URL_B": os.getenv("WS_URL_B"),
        "WS_URL_AB": os.getenv("WS_URL_AB"),
        "CHAR_PREFIX_A": os.getenv("CHAR_PREFIX_A"),
        "CHAR_PREFIX_B": os.getenv("CHAR_PREFIX_B"),
    }
