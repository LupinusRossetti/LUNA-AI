import asyncio
import websockets
import json

rooms = {
    "wsA": set(),
    "wsB": set(),
    "wsAB": set(),
}

def detect_room(path: str) -> str:
    key = path.replace("/", "")
    return key if key in rooms else "wsA"

async def handler(websocket, path):
    room = detect_room(path)
    rooms[room].add(websocket)
    print(f"[WS] Connected → room={room}")

    try:
        async for message in websocket:
            print(f"[{room}] Received(raw):", message)

            try:
                data = json.loads(message)
            except:
                continue

            # AItuberKit がユーザー発言を受信したときだけ
            if data.get("role") == "user":
                text = data.get("text", "")

                # ① start
                start_msg = {
                    "role": "assistant",
                    "type": "start"
                }
                # ② message
                content_msg = {
                    "role": "assistant",
                    "type": "message",
                    "text": f"フィオナです！『{text}』って聞こえたよ♪"
                }
                # ③ end
                end_msg = {
                    "role": "assistant",
                    "type": "end"
                }

                # 同じ部屋全員に送る
                for ws in list(rooms[room]):
                    try:
                        await ws.send(json.dumps(start_msg))
                        await ws.send(json.dumps(content_msg))
                        await ws.send(json.dumps(end_msg))
                    except:
                        pass

    except Exception as e:
        print(f"[WS ERROR] {e}")

    finally:
        rooms[room].discard(websocket)
        print(f"[WS] Disconnected → room={room}")


async def main():
    print("[WS] Simple WebSocket Server starting at ws://localhost:8765 ...")
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
