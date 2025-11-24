# =========================================================
# simple_ws_server.py（完全修正版 v2）
# AB → A / B に必ず転送する版
# =========================================================

import asyncio
from aiohttp import web
import json

rooms = {
    "A": set(),
    "B": set(),
    "AB": set(),
}

valid_paths = {
    "/A": "A",
    "/B": "B",
    "/ab": "AB",
    "/AB": "AB",
    "/WA": "A",
    "/WB": "B",
}

async def websocket_handler(request):
    path = request.path
    room = valid_paths.get(path)

    if room is None:
        print(f"[WS] invalid path → {path}")
        return web.Response(text="Invalid WS path")

    ws = web.WebSocketResponse()
    await ws.prepare(request)

    print(f"[WS] connected → {room}")
    rooms[room].add(ws)

    try:
        async for msg in ws:
            if msg.type != web.WSMsgType.TEXT:
                continue

            raw = msg.data
            print(f"[{room}] chat:", raw)

            # ===== 部屋別転送ロジック =====

            # ★ AB → A と B の router に転送！
            if room == "AB":
                # AB の全クライアントへ
                for client in rooms["AB"]:
                    if client != ws:
                        await client.send_str(raw)

                # A の全クライアント（WA 含む）へ転送
                for client in rooms["A"]:
                    await client.send_str(raw)

                # B の全クライアント（WB 含む）へ転送
                for client in rooms["B"]:
                    await client.send_str(raw)

                continue

            # ★ A または B の場合：同じ部屋と AB にも投げる
            for client in rooms[room]:
                if client != ws:
                    await client.send_str(raw)

            # AB にもログ転送
            for client in rooms["AB"]:
                await client.send_str(raw)

    finally:
        rooms[room].discard(ws)
        print(f"[WS] disconnected → {room}")

    return ws

app = web.Application()
for path in valid_paths:
    app.router.add_get(path, websocket_handler)

if __name__ == '__main__':
    web.run_app(app, host="0.0.0.0", port=8765)
