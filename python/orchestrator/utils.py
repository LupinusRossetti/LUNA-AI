import os
import json
import websockets
import asyncio
import re
import google.generativeai as genai

# ============================================================
# ENV
# ============================================================
PREFIX_A = os.environ.get("CHAR_PREFIX_A", "IR").lower()
PREFIX_B = os.environ.get("CHAR_PREFIX_B", "FI").lower()

APP_MODE = os.environ.get("APP_MODE", "A")  # A / B / AB

WS_A = os.environ.get("WS_URL_A", "ws://localhost:8765/wsA")
WS_B = os.environ.get("WS_URL_B", "ws://localhost:8765/wsB")
WS_AB = os.environ.get("WS_URL_AB", "ws://localhost:8765/wsAB")

MODEL_NAME = os.environ.get("MODEL", "gemini-2.0-flash")

# キャラタグ（変更可能）
TAG_A = os.environ.get("TAG_A", "A")
TAG_B = os.environ.get("TAG_B", "B")

# 文字数制限
LIMIT_A = int(os.environ.get("LIMIT_A", "250"))
LIMIT_B = int(os.environ.get("LIMIT_B", "250"))
LIMIT_AB = int(os.environ.get("LIMIT_AB", "500"))

# dual prompt path
DUAL_PROMPT_FILE = os.environ.get("PROMPT_FILE_AB")

# ============================================================
# Gemini モデル
# ============================================================
genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))


def get_model_instance():
    """Geminiモデルを env に基づいて生成（ハードコーディングゼロ）"""
    return genai.GenerativeModel(MODEL_NAME)


# ============================================================
# 読み込み系
# ============================================================
def load_dual_prompt():
    """掛け合い用 dual プロンプト読み込み"""
    if not DUAL_PROMPT_FILE or not os.path.exists(DUAL_PROMPT_FILE):
        raise RuntimeError(f"Dual prompt file not found: {DUAL_PROMPT_FILE}")

    with open(DUAL_PROMPT_FILE, "r", encoding="utf-8") as f:
        return f.read()


# ============================================================
# Normalモード用：正規化 ＆ ターゲット判定
# ============================================================
def normalize(text: str):
    if not text:
        return ""
    t = text.lower()
    t = t.replace("　", " ")
    t = t.strip()
    return t


def detect_target_char(user_text: str) -> tuple[str, str]:
    """Normal モードのターゲット判定（IR/FI / 単体 / 掛け合い）"""
    t = normalize(user_text)

    if PREFIX_A and t.startswith(PREFIX_A.lower()):
        clean = t[len(PREFIX_A):].strip()
        return "A", clean

    if PREFIX_B and t.startswith(PREFIX_B.lower()):
        clean = t[len(PREFIX_B):].strip()
        return "B", clean

    if APP_MODE == "A":
        return "A", user_text
    if APP_MODE == "B":
        return "B", user_text

    return "A", user_text  # 掛け合いはA開始


# ============================================================
# XML パース（掛け合いモード用）
# ============================================================
def extract_turns_xml(text: str, tagA: str, tagB: str):
    """
    <A>...</A> / <B>...</B> を順番通りに抽出
    """
    patternA = rf"<{tagA}>(.*?)</{tagA}>"
    patternB = rf"<{tagB}>(.*?)</{tagB}>"

    combined = re.finditer(
        rf"<({tagA}|{tagB})>(.*?)</\1>",
        text,
        re.DOTALL
    )

    turns = []
    for match in combined:
        char = match.group(1)
        body = match.group(2).strip()
        turns.append((char, body))

    return turns


# ============================================================
# AItuberKit 送信
# ============================================================
async def send_turn(ws_url: str, text: str, char: str, emotion="neutral", mode="normal"):

    async with websockets.connect(ws_url) as ws:

        await ws.send(json.dumps({
            "type": "start",
            "role": "assistant",
            "meta": {"character": char, "mode": mode}
        }, ensure_ascii=False))

        await ws.send(json.dumps({
            "type": "message",
            "role": "assistant",
            "text": text,
            "emotion": emotion,
            "meta": {"character": char, "mode": mode}
        }, ensure_ascii=False))

        await ws.send(json.dumps({
            "type": "end",
            "role": "assistant",
            "meta": {"character": char, "mode": mode}
        }, ensure_ascii=False))


# ============================================================
# ログ送信
# ============================================================
async def send_log(text: str, char: str):
    try:
        async with websockets.connect(WS_AB) as ws:
            await ws.send(json.dumps({
                "type": "log",
                "character": char,
                "text": text
            }, ensure_ascii=False))
    except:
        pass
