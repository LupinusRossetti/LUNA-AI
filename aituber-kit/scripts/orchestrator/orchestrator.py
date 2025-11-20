import time
import asyncio
import json
import os
import re
import websockets
import requests

from youtube_client import YouTubeClient
from aituberkit_client import AITuberKitClient


# -----------------------------
#  環境設定（env.A / env.B）
# -----------------------------
def load_env(path):
    data = {}
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    data[k] = v
    return data


envA = load_env(".env.A")
envB = load_env(".env.B")

# -----------------------------
#  キャラごとのプレフィックス（必須）
# -----------------------------
CHAR_A_PREFIX = envA.get("CHAR_PREFIX")
if not CHAR_A_PREFIX:
    raise ValueError("ERROR: .env.A に CHAR_PREFIX がありません")

CHAR_B_PREFIX = envB.get("CHAR_PREFIX")
if not CHAR_B_PREFIX:
    raise ValueError("ERROR: .env.B に CHAR_PREFIX がありません")

print("Character prefix A =", CHAR_A_PREFIX)
print("Character prefix B =", CHAR_B_PREFIX)

# -----------------------------
#  クライアント初期化
# -----------------------------
yt = YouTubeClient()  # 既存の投稿用スクリプトを内部利用
clientA = AITuberKitClient("http://localhost:3000", "ws://localhost:3000/api/external/ws")
clientB = AITuberKitClient("http://localhost:3001", "ws://localhost:3001/api/external/ws")


# -----------------------------
#  コメント振り分け
# -----------------------------
def detect_target(text: str):
    if text.upper().startswith(CHAR_A_PREFIX.upper()):
        return "A"
    if text.upper().startswith(CHAR_B_PREFIX.upper()):
        return "B"
    return None


# -----------------------------
#  メインループ
# -----------------------------
async def main():
    print("===== Python Orchestrator Started =====")

    # WebSocket 接続（A / B）
    await clientA.connect()
    await clientB.connect()

    last_timestamp = None

    while True:
        comments = yt.fetch_chat_messages()

        for c in comments:
            author = c["author"]
            text = c["text"]
            print(f"[YT] {author}: {text}")

            target = detect_target(text)

            if target == "A":
                clean_message = text[len(CHAR_A_PREFIX):].strip()
                clientA.send_message(clean_message)

            elif target == "B":
                clean_message = text[len(CHAR_B_PREFIX):].strip()
                clientB.send_message(clean_message)

        # A の返答
        msgA = clientA.get_latest_message()
        if msgA:
            print("[A RESP]", msgA)
            yt.post_message(msgA)

        # B の返答
        msgB = clientB.get_latest_message()
        if msgB:
            print("[B RESP]", msgB)
            yt.post_message(msgB)

        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
