import os
import json
import asyncio
import websockets
from dotenv import load_dotenv
import google.generativeai as genai

# ============================================
# .env 読み込み
# ============================================
load_dotenv()

API_KEY = os.environ.get("GOOGLE_API_KEY")
MODEL = os.environ.get("MODEL", "gemini-2.0-flash")
PROMPT_FILE = os.environ.get("PROMPT_FILE")
WS_URL = os.environ.get("WS_URL", "ws://localhost:8765/wsB")
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
# プロンプト読み込み
# ============================================
with open(PROMPT_FILE, "r", encoding="utf-8") as f:
    system_prompt = f.read()

print(f"[characterB] プロンプト読込成功: {PROMPT_FILE}")
print(f"[characterB] 接続開始: {WS_URL}")

# ============================================
# Gemini 返答関数
# ============================================
def talk_with_gemini(user_text: str) -> str:

    grounding_instruction = ""
    if USE_SEARCH:
        grounding_instruction = "必要に応じて検索して回答してください。\n"

    prompt = (
        f"{system_prompt}\n"
        f"{grounding_instruction}"
        f"ユーザー: {user_text}\n"
        f"あなた（キャラB）として返答してください："
    )

    res = model.generate_content(prompt)
    return res.text.strip()


# ============================================
# AITuberKit 通信
# ============================================
async def connect_and_listen():

    async with websockets.connect(WS_URL) as ws:
        print("[characterB] AITuberKit に接続しました")

        while True:
            try:
                raw = await ws.recv()
                data = json.loads(raw)

                role = data.get("role")
                msg_type = data.get("type")
                text = data.get("text")

                # ログ
                print(f"[RECV] {data}")

                # --- user が chat を送った時だけ返答 ---
                if role == "user" and msg_type == "chat" and text:
                    print(f"[USER] {text}")

                    ai_reply = await asyncio.to_thread(talk_with_gemini, text)

                    # --------------------------------------------
                    # 正規プロトコル：start → message → end
                    # --------------------------------------------
                    await ws.send(json.dumps({
                        "role": "assistant",
                        "type": "start"
                    }, ensure_ascii=False))
                    print("[SEND_B] start")

                    await ws.send(json.dumps({
                        "role": "assistant",
                        "type": "message",
                        "text": ai_reply,
                        "emotion": "neutral"
                    }, ensure_ascii=False))
                    print("[SEND_B] message (full)")

                    await ws.send(json.dumps({
                        "role": "assistant",
                        "type": "end"
                    }, ensure_ascii=False))
                    print("[SEND_B] end")

            except websockets.ConnectionClosed:
                print("[characterB] WebSocket が切断されました。再接続します...")
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
            print("[characterB] エラー:", e)
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
