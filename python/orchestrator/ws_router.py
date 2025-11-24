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
        try:
            jd = json.loads(raw)

            if jd.get("type") != "speech_end":
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
async def send_turn(ws, text, character: str):
    turn_id = next_turn_id()

    payload_base = {
        "role": "assistant",
        "meta": {
            "character": character,
            "turnId": turn_id
        }
    }

    # start
    await ws.send(json.dumps({
        "type": "start",
        **payload_base
    }, ensure_ascii=False))

    # message
    await ws.send(json.dumps({
        "type": "message",
        "text": text,
        **payload_base
    }, ensure_ascii=False))

    # end
    await ws.send(json.dumps({
        "type": "end",
        **payload_base
    }, ensure_ascii=False))

    # wait until the exact same turnID returns
    await wait_speech_end(ws, turn_id, character)

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

                # ===== Gemini に投げる =====
                stream = gen.run(text, source)
                full = await read_stream(stream)

                if not full:
                    continue

                print("[XML]")
                print(full)

                # ===== XML をターン単位に分解 =====
                turns = XML_PATTERN.findall(full)
                if not turns:
                    turns = [(source, full)]  # fallback

                # ===== 順番に送信 =====
                for sp, tx in turns:
                    if sp == "A":
                        await send_turn(wsA, tx, "A")
                    else:
                        await send_turn(wsB, tx, "B")

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
