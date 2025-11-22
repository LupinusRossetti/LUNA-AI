import os
import json
import asyncio
import websockets
from dotenv import load_dotenv
import google.generativeai as genai

# ============================================
# .env 読込
# ============================================
load_dotenv()

API_KEY = os.environ.get("GOOGLE_API_KEY")
MODEL = os.environ.get("MODEL", "gemini-2.0-flash")
PROMPT_FILE = os.environ.get("PROMPT_FILE")   # ← start_B_dev.bat がセット
WS_URL = os.environ.get("WS_URL")             # ← "ws://localhost:8000/wsB"
USE_SEARCH = os.environ.get("USE_SEARCH_GROUNDING", "false") == "true"

if not API_KEY:
    raise RuntimeError("❌ GOOGLE_API_KEY が読み込めません。")

if not PROMPT_FILE or not os.path.exists(PROMPT_FILE):
    raise RuntimeError(f"❌ PROMPT_FILE が存在しません: {PROMPT_FILE}")

if not WS_URL:
    raise RuntimeError("❌ WS_URL が設定されていません")


# ============================================
# Gemini 設定
# ============================================
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel(MODEL)


# ============================================
# プロンプト読込
# ============================================
with open(PROMPT_FILE, "r", encoding="utf-8") as f:
    system_prompt = f.read()

print(f"[characterB] PROMPT_FILE loaded: {PROMPT_FILE}")
print(f"[characterB] Connecting to: {WS_URL}")


# ============================================
# Gemini 応答生成
# ============================================
def talk_with_gemini(user_text: str) -> str:

    grounding_instruction = ""
    if USE_SEARCH:
        grounding_instruction = (
            "※必要に応じて検索して、信頼できる情報を元に答えてください。\n"
        )

    prompt = (
        f"{system_prompt}\n"
        f"{grounding_instruction}"
        f"ユーザー: {user_text}\n"
        f"あなたはキャラクタープロンプトに従って返答してください："
    )

    res = model.generate_content(prompt)
    return res.text.strip()


# ============================================
# AITuberKit 通信
# ============================================
async def connect_and_listen():

    async with websockets.connect(WS_URL) as ws:
        print("[characterB] Connected:", WS_URL)

        while True:
            try:
                raw = await ws.recv()
                data = json.loads(raw)

                # target があり、B 用でない場合 → 無視
                target = data.get("target")
                if target and target != "B":
                    continue

                text = data.get("content")
                msg_type = data.get("type")

                if msg_type == "chat" and text:
                    print(f"[AITuberKit → B] {text}")

                    ai_reply = await asyncio.to_thread(talk_with_gemini, text)

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
                print("[characterB] WS disconnected. Reconnecting...")
                await asyncio.sleep(1)
                return

# ============================================
# メイン
# ============================================
async def main():
    while True:
        try:
            await connect_and_listen()
        except Exception as e:
            print("[characterB ERROR]:", e)
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
