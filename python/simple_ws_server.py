# simple_ws_server.py  ★ 完全版 ★

import asyncio
from aiohttp import web
import json
import websockets

rooms = {
    "A": set(),
    "B": set(),
    "AB": set(),
}

alias = {
    "WA": "A",
    "WB": "B",
    "ab": "AB",
    "AB": "AB",
}

def get_room_from_path(path: str) -> str:
    clean = path.replace("/", "")
    if clean in rooms:
        return clean
    if clean in alias:
        return alias[clean]
    return "A"


# ------ router への“常時接続”を保持する ------
router_ws_A = None
router_ws_B = None

async def ensure_router_ws():
    """WA / WB へ常に接続し続ける"""
    global router_ws_A, router_ws_B

    while True:
        # WA
        if router_ws_A is None or router_ws_A.closed:
            try:
                router_ws_A = await websockets.connect("ws://localhost:8765/WA")
                print("[simple] Connected router WA")
            except:
                pass

        # WB
        if router_ws_B is None or router_ws_B.closed:
            try:
                router_ws_B = await websockets.connect("ws://localhost:8765/WB")
                print("[simple] Connected router WB")
            except:
                pass

        await asyncio.sleep(1)


async def forward_to_router(json_data):
    """既存の router WS に送信"""
    global router_ws_A, router_ws_B

    source = json_data.get("source")

    try:
        if source == "A" and router_ws_A and not router_ws_A.closed:
            await router_ws_A.send(json.dumps(json_data, ensure_ascii=False))
        elif source == "B" and router_ws_B and not router_ws_B.closed:
            await router_ws_B.send(json.dumps(json_data, ensure_ascii=False))
        else:
            print("[simple] No router WS available")
    except Exception as e:
        print("[simple] forward error:", e)


async def websocket_handler(request):
    path = request.path.replace("/", "")
    room = get_room_from_path(path)

    ws = web.WebSocketResponse()
    await ws.prepare(request)

    print(f"[WS] Client connected → room={room}")
    rooms[room].add(ws)

    try:
        async for msg in ws:
            if msg.type == web.WSMsgType.TEXT:
                raw = msg.data
                print(f"[{room}] Received:", raw)

                # Router へ転送
                try:
                    jd = json.loads(raw)
                    await forward_to_router(jd)
                except:
                    pass

                # 同室の他クライアントへ送る
                for client in rooms[room]:
                    if client != ws:
                        await client.send_str(raw)

    finally:
        rooms[room].discard(ws)
        print(f"[WS] Client disconnected → room={room}")

    return ws


app = web.Application()
app.router.add_get('/{tail:.*}', websocket_handler)

if __name__ == '__main__':
    loop = asyncio.get_event_loop()
    loop.create_task(ensure_router_ws())
    web.run_app(app, host="0.0.0.0", port=8765)
