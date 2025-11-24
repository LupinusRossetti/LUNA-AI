import asyncio
import json
import traceback
import websockets
import re

from .router import get_generator

TURN_ID = 0

def next_turn_id():
    global TURN_ID
    TURN_ID += 1
    return TURN_ID


# ============================================================
# Generator（A/B掛け合いAI本体）
# ============================================================
gen = get_generator()

# A/B ターゲット（WA / WB）
WS_A_PATH = "ws://localhost:8765/WA"
WS_B_PATH = "ws://localhost:8765/WB"

# XML 抽出（emotion 含む）
XML_PATTERN = re.compile(r'<(A|B)(?:\s+[^>]*)?>(.*?)</\1>', re.DOTALL)

# ============================================================
# 安定接続：WebSocket コネクタ
# ============================================================
async def connect_ws(url: str):
    """WebSocket が死んだら必ず再接続して返す"""
    while True:
        try:
            ws = await websockets.connect(url)
            print(f"[Router] Connected → {url}")
            return ws
        except:
            print(f"[Router] Waiting → {url}")
            await asyncio.sleep(1)

# ============================================================
# Gemini stream を完全吸収するユーティリティ
# ============================================================
async def read_stream(stream):
    """Gemini stream を全形式対応で安定結合"""
    out = ""
    async for chunk in stream:
        t = getattr(chunk, "text", None)
        if t:
            out += t
            continue

        if hasattr(chunk, "parts"):
            for p in chunk.parts:
                if hasattr(p, "text"):
                    out += p.text

        if hasattr(chunk, "candidates"):
            for c in chunk.candidates:
                if hasattr(c, "content"):
                    for p in c.content.parts:
                        if hasattr(p, "text"):
                            out += p.text

    return out.strip()

# ============================================================
# speech_end を待機する
# ============================================================
async def wait_speech_end(ws, turn_id: int, character: str):
    while True:
        raw = await ws.recv()
        # print(f"[Router] Debug Recv: {raw}") # 必要ならコメントアウト解除
        try:
            jd = json.loads(raw)

            if jd.get("type") != "speech_end":
                # speech_end 以外は無視するがログには出す（デバッグ用）
                # print(f"[Router] Ignored in wait_speech_end: {jd.get('type')}")
                continue

            # character & turnId must match
            if jd.get("character") != character:
                continue

            if jd.get("turnId") != turn_id:
                continue

            return  # 完全一致 → 次のターンへ進む！

        except:
            continue

# ============================================================
# ターンを AItuberKit に送る
# ============================================================
# ============================================================
# ターンを AItuberKit に送る（全員に送って target で制御）
# ============================================================
async def broadcast_turn(wsA, wsB, text, character: str):
    turn_id = next_turn_id()
    print(f"[Router] >>> ターン {turn_id} を {character} に送信 (テキスト: {text[:20]}...)")

    payload_base = {
        "role": "assistant",
        "target": character,  # handlers.ts でこれで判定する
        "meta": {
            "character": character,
            "turnId": turn_id
        }
    }

    # simple_ws_serverが/ABルームにブロードキャストするので、wsAのみに送信
    async def send_to_room(data):
        json_str = json.dumps(data, ensure_ascii=False)
        await wsA.send(json_str)

    # start
    await send_to_room({
        "type": "start",
        **payload_base
    })

    # message
    await send_to_room({
        "type": "message",
        "text": text,
        **payload_base
    })

    # end
    await send_to_room({
        "type": "end",
        **payload_base
    })

    # wait until the exact same turnID returns from the TARGET
    target_ws = wsA if character == "A" else wsB
    print(f"[Router] ターン {turn_id} の speech_end を {character} から待機中...")
    await wait_speech_end(target_ws, turn_id, character)
    print(f"[Router] <<< ターン {turn_id} 完了")

# ============================================================
# メインループ
# ============================================================
async def main_loop():
    while True:
        try:
            print("[Router] --- Waiting A/B endpoints ---")
            wsA = await connect_ws(WS_A_PATH)
            wsB = await connect_ws(WS_B_PATH)

            print("[Router] --- Ready for dialogue ---")

            # A/B両方のメッセージを監視
            while True:
                done, pending = await asyncio.wait(
                    [
                        asyncio.create_task(wsA.recv()),
                        asyncio.create_task(wsB.recv())
                    ],
                    return_when=asyncio.FIRST_COMPLETED
                )

                for t in pending:
                    t.cancel()

                raw = list(done)[0].result()
                data = json.loads(raw)

                if data.get("type") != "chat":
                    continue

                text = data["text"]
                source = data["source"]  # "A" or "B"

                # ===== ユーザーメッセージを両クライアントに送信 =====
                user_msg = {
                    "type": "user_message",  # typeを追加
                    "role": "user",
                    "text": text,
                    "source": source
                }
                user_msg_str = json.dumps(user_msg, ensure_ascii=False)
                await wsA.send(user_msg_str)
                print(f"[Router] ユーザーメッセージをブロードキャスト: {text[:30]}...")

                # ===== Gemini に投げる =====
                stream = await gen.run(text, source)
                full = await read_stream(stream)

                if not full:
                    continue

                print(f"[Router] Gemini応答:\n{full}")

                # Markdownコードブロックの削除 (```xml ... ``` or ``` ... ```)
                clean_text = re.sub(r"```(?:xml)?\s*(.*?)\s*```", r"\1", full, flags=re.DOTALL).strip()
                
                print("[XML] (Cleaned)")
                print(clean_text)

                # ===== XML をターン単位に分解 =====
                turns = XML_PATTERN.findall(clean_text)
                if not turns:
                    print("[Router] No XML tags found, using raw text as fallback.")
                    turns = [(source, clean_text)]  # fallback

                # ===== 順番に送信 =====
                # ===== 順番に送信 =====
                for sp, tx in turns:
                    # A/B どちらが喋る場合でも、両方に送ってログを同期する
                    # broadcast_turn 内部で target 指定を行い、クライアント側で発話/ログのみを判断
                    await broadcast_turn(wsA, wsB, tx, sp)

        except Exception:
            traceback.print_exc()
            print("[Router] Reconnecting in 3s...")
            await asyncio.sleep(3)

# ============================================================
# エントリーポイント
# ============================================================
def start():
    asyncio.run(main_loop())

if __name__ == "__main__":
    start()
