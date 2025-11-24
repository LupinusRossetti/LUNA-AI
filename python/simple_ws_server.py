# simple_ws_server.py 改修版
import asyncio
from aiohttp import web, WSMsgType

rooms = {
    "A": set(),
    "B": set(),
    "WA": set(),
    "WB": set(),
    "wsAB": set(),   # ★ ログ配送ルーム
}

def get_room_from_path(path: str) -> str:
    clean = path.replace("/", "")
    return clean if clean in rooms else None

async def websocket_handler(request):
    path = request.path.replace("/", "")
    room = get_room_from_path(path)

    if room is None:
        return web.Response(status=404, text="Invalid WS path")

    ws = web.WebSocketResponse(heartbeat=20)
    await ws.prepare(request)

    print(f"[WS] Client connected → room={room}")
    rooms[room].add(ws)

    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                data = msg.data

                # ★ wsAB → A/B にブロードキャスト
                if room == "wsAB":
                    for target_room in ["A", "B"]:
                        for client in rooms[target_room]:
                            await client.send_str(data)

            elif msg.type == WSMsgType.ERROR:
                print(f"[WS] Error: {ws.exception()}")
    finally:
        # ★ disconnect cleanup
        if ws in rooms[room]:
            rooms[room].remove(ws)
        print(f"[WS] Client disconnected → room={room}")

    return ws

app = web.Application()
app.add_routes([web.get("/{tail:.*}", websocket_handler)])

if __name__ == "__main__":
    print("WS server at ws://localhost:8765 ...")
    web.run_app(app, port=8765)
