import os
import json
import asyncio
import websockets
from dotenv import load_dotenv
import google.generativeai as genai

# ======================================================
# .env 読込
# ======================================================
load_dotenv()

API_KEY = os.environ.get("GOOGLE_API_KEY")
MODEL = os.environ.get("MODEL", "gemini-2.0-flash")
PROMPT_A = os.environ.get("PROMPT_FILE_A")
PROMPT_B = os.environ.get("PROMPT_FILE_B")
PROMPT_AB = os.environ.get("PROMPT_FILE_AB")
WS_URL = os.environ.get("WS_URL_AB")
USE_SEARCH = os.environ.get("USE_SEARCH_GROUNDING", "false") == "true"

if not API_KEY:
    raise RuntimeError("❌ GOOGLE_API_KEY がありません")

if not all([PROMPT_A, PROMPT_B, PROMPT_AB]):
    raise RuntimeError("❌ PROMPT_FILE_A/B/AB が設定されていません")

if not WS_URL:
    raise RuntimeError("❌ WS_URL_AB が設定されていません")

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel(MODEL)

# ------------------------------------------------------
# プロンプト読込
# ------------------------------------------------------
with open(PROMPT_A, "r", encoding="utf-8") as f:
    promptA = f.read()

with open(PROMPT_B, "r", encoding="utf-8") as f:
    promptB = f.read()

with open(PROMPT_AB, "r", encoding="utf-8") as f:
    promptAB = f.read()

print("[characterAB] Loaded prompts & connecting to:", WS_URL)


# ======================================================
# Gemini 応答生成
# ======================================================
def talk_with_gemini(user_text: str, first_speaker: str) -> str:

    grounding = "※必要なら検索を使い、正確な情報を元に返答してください。\n" if USE_SEARCH else ""

    # target=A のときは A → B → A …  
    # target=B のときは B → A → B …
    first = "A" if first_speaker.upper() == "A" else "B"

    prompt = (
        f"{promptAB}\n\n"
        f"【追加指示】\n"
        f"掛け合いの最初の発話者は {first} とします。\n"
        f"{grounding}"
        f"【ユーザー入力】{user_text}\n"
        f"掛け合いを生成してください。\n"
    )

    res = model.generate_content(prompt)
    return res.text.strip()


# ======================================================
# WebSocket 連携
# ======================================================
async def connect_and_listen():

    async with websockets.connect(WS_URL) as ws:
        print("[characterAB] Connected!")

        while True:
            try:
                raw = await ws.recv()
                data = json.loads(raw)

                text = data.get("content")
                msg_type = data.get("type")
                target = data.get("target")  # ← A or B

                if msg_type == "chat" and text:

                    first = "A"
                    if isinstance(target, str):
                        if target.lower().startswith("b"):
                            first = "B"

                    print(f"[AB recv] text='{text}' first={first}")

                    ai_reply = await asyncio.to_thread(
                        talk_with_gemini, text, first
                    )

                    await ws.send(json.dumps({
                        "type": "start",
                        "role": "assistant",
                        "text": "",
                        "emotion": "neutral"
                    }, ensure_ascii=False))

                    await ws.send(json.dumps({
                        "type": "message",
                        "role": "assistant",
                        "text": ai_reply,
                        "emotion": "neutral"
                    }, ensure_ascii=False))

                    await ws.send(json.dumps({
                        "type": "end",
                        "role": "assistant",
                        "text": "",
                        "emotion": "neutral"
                    }, ensure_ascii=False))

            except websockets.ConnectionClosed:
                print("[characterAB] WS disconnected. Retry…")
                await asyncio.sleep(1)
                return


async def main():
    while True:
        try:
            await connect_and_listen()
        except Exception as e:
            print("[characterAB ERROR]:", e)
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
