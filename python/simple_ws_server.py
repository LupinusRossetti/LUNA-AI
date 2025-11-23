import asyncio
import websockets
import json

# ============================================
# 部屋（A / B / AB）
# ============================================
rooms = {
    "wsA": set(),
    "wsB": set(),
    "wsAB": set(),
}

def detect_room(path: str) -> str:
    """
    /wsA → wsA
    /wsB → wsB
    /wsAB → wsAB
    どれでもない場合は wsA にフォールバック
    """
    key = path.replace("/", "")
    return key if key in rooms else "wsA"

# ============================================
# メインハンドラ：完全中継専用
# ============================================
async def handler(websocket, path):
    room = detect_room(path)
    rooms[room].add(websocket)

    print(f"[WS] Connected → room={room}")

    try:
        async for message in websocket:
            print(f"[{room}] Received(raw): {message}")

            # JSON ONLY
            try:
                data = json.loads(message)
            except:
                print(f"[WARN] Non-JSON ignored: {message}")
                continue

            # 中継（送信元を含む全員に送る = 仕様上問題なし）
            for ws in list(rooms[room]):
                try:
                    await ws.send(json.dumps(data, ensure_ascii=False))
                except Exception as e:
                    print(f"[WS SEND ERROR] {e}")

    except Exception as e:
        print(f"[WS ERROR] {e}")

    finally:
        rooms[room].discard(websocket)
        print(f"[WS] Disconnected → room={room}")

# ============================================
# サーバ起動
# ============================================
async def main():
    port = 8765
    print(f"[WS] Simple WebSocket Server starting at ws://localhost:{port} ...")

    async with websockets.serve(handler, "localhost", port):
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    asyncio.run(main())
