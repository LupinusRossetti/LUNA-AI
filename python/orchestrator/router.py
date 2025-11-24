# router.py
import os
from dotenv import load_dotenv

load_dotenv()

# A / B / AB
APP_MODE = os.getenv("APP_MODE", "A")

# WebSocket URL
WS_URL_A  = os.getenv("WS_URL_A",  "ws://localhost:8765/wsA")
WS_URL_B  = os.getenv("WS_URL_B",  "ws://localhost:8765/wsB")
WS_URL_AB = os.getenv("WS_URL_AB", "ws://localhost:8765/wsAB")

def get_ws_url():
    if APP_MODE == "A":
        return WS_URL_A
    elif APP_MODE == "B":
        return WS_URL_B
    elif APP_MODE == "AB":
        return WS_URL_AB
    else:
        raise ValueError(f"Invalid APP_MODE: {APP_MODE}")

def get_generator():
    if APP_MODE in ["A", "B"]:
        from .generator_normal import GeneratorNormal
        return GeneratorNormal()
    elif APP_MODE == "AB":
        from .generator_ab import GeneratorAB
        return GeneratorAB()
    else:
        raise ValueError(f"Invalid APP_MODE: {APP_MODE}")
