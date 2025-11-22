import asyncio
import websockets
import json

# ============================================================
# 部屋ごとの接続者リスト
# ============================================================
rooms = {
    "wsA": set(),     # ソロ A
    "wsB": set(),     # ソロ B
    "wsAB": set(),    # 掛け合い AB
}

# ============================================================
# ユーティリティ：パスから room 判定
# ============================================================
def get_room_from_path(path: str) -> str:
    clean = path.replace("/", "")
    return clean if clean in rooms else "wsA"


# ============================================================
# クライアント処理
# ============================================================
async def handler(ws, path):
    room = get_room_from_path(path)
    print(f"[Server] Client connected → room: {room}")

    rooms[room].add(ws)

    try:
        async for raw in ws:
            print(f"[{room}] Received:", raw)

            # JSON 解析（target があるか確認）
            try:
                data = json.loads(raw)
            except:
                data = {}

            target = data.get("target")  # "A" / "B" / None

            # ====================================================
            # AB 部屋専用：target に応じて配信先を絞る
            # ====================================================
            if room == "wsAB" and target in ("A", "B"):
                for client in rooms[room]:
                    # A のクライアント → PATH が wsA
                    # B のクライアント → PATH が wsB
                    client_path = client.path.replace("/", "")

                    if target == "A" and client_path == "wsA":
                        await client.send(raw)

                    if target == "B" and client_path == "wsB":
                        await client.send(raw)

                continue  # これ以上の処理不要


            # ====================================================
            # 通常モード：送信者以外にブロードキャスト
            # ====================================================
            for client in rooms[room]:
                if client != ws:
                    try:
                        await client.send(raw)
                    except:
                        pass

    except websockets.exceptions.ConnectionClosed:
        print(f"[Server] Client disconnected from {room}")

    finally:
        rooms[room].remove(ws)


# ============================================================
# メイン
# ============================================================
async def main():
    print("WebSocket server running on:")
    print("  ws://localhost:8000/wsA  (ソロA)")
    print("  ws://localhost:8000/wsB  (ソロB)")
    print("  ws://localhost:8000/wsAB (掛け合いAB)")
    print("===================================================")

    async with websockets.serve(handler, "localhost", 8000):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
