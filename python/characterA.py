import os
import json
import asyncio
import websockets
import requests
from dotenv import load_dotenv
import google.generativeai as genai

# ============================================
# .env 読込
# ============================================
load_dotenv()

API_KEY = os.environ.get("GOOGLE_API_KEY")
MODEL = os.environ.get("MODEL", "gemini-2.0-flash")
PROMPT_FILE = os.environ.get("PROMPT_FILE")
WS_URL = os.environ.get("WS_URL", "ws://localhost:8765/ws")
USE_SEARCH = os.environ.get("USE_SEARCH_GROUNDING", "false") == "true"

if not API_KEY:
    raise RuntimeError("❌ GOOGLE_API_KEY が読み込めません。")

if not PROMPT_FILE or not os.path.exists(PROMPT_FILE):
    raise RuntimeError(f"❌ PROMPT_FILE が存在しません: {PROMPT_FILE}")

# ============================================
# Gemini 設定
# ============================================
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel(MODEL)

# ============================================
# プロンプト讀込
# ============================================
with open(PROMPT_FILE, "r", encoding="utf-8") as f:
    system_prompt = f.read()

print(f"[characterA] プロンプト読込成功: {PROMPT_FILE}")
print(f"[characterA] 接続開始: {WS_URL}")

# ============================================
# Gemini 問い合わせ
# ここでは返答は "全文" として返す
# ============================================
def talk_with_gemini(user_text: str) -> str:

    grounding_instruction = ""
    if USE_SEARCH:
        grounding_instruction = (
            "※必要に応じて検索し、信頼できる情報を元に答えてください。\n"
        )

    prompt = (
        f"{system_prompt}\n"
        f"{grounding_instruction}"
        f"ユーザー: {user_text}\n"
        f"アイリスとして返答してください："
    )

    res = model.generate_content(prompt)
    return res.text.strip()


# ============================================
# AITuberKit 通信
# ============================================
async def connect_and_listen():

    async with websockets.connect(WS_URL) as ws:
        print("[characterA] AITuberKit に接続しました")

        while True:
            try:
                raw = await ws.recv()
                data = json.loads(raw)

                text = data.get("content")
                msg_type = data.get("type")

                # ユーザーからのチャット
                if msg_type == "chat" and text:
                    print(f"[From AITuberKit] {text}")

                    # Gemini へ問い合わせ（全文）
                    ai_reply = await asyncio.to_thread(talk_with_gemini, text)

                    # ============================================
                    # AITuberKit 正規プロトコル
                    # start → message（全文）→ end
                    # ============================================
                    await ws.send(json.dumps({
                        "type": "start",
                        "role": "assistant",
                        "text": "",
                        "emotion": "neutral"
                    }, ensure_ascii=False))
                    print("[SEND] assistant start")

                    await ws.send(json.dumps({
                        "type": "message",
                        "role": "assistant",
                        "text": ai_reply,
                        "emotion": "neutral"
                    }, ensure_ascii=False))
                    print("[SEND] assistant message (full text)")

                    await ws.send(json.dumps({
                        "type": "end",
                        "role": "assistant",
                        "text": "",
                        "emotion": "neutral"
                    }, ensure_ascii=False))
                    print("[SEND] assistant end")

            except websockets.ConnectionClosed:
                print("WebSocket が切断されました。再接続します...")
                await asyncio.sleep(1)
                return


# ============================================
# メインループ
# ============================================
async def main():
    while True:
        try:
            await connect_and_listen()
        except Exception as e:
            print("エラー:", e)
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
