import asyncio
import websockets
import json

async def test():
    uri = "ws://localhost:8765/wsA"
    async with websockets.connect(uri) as ws:
        msg = {
            "text": "Pythonからのテスト発話！",
            "role": "user",
            "emotion": "joy",
            "type": "chat"
        }
        await ws.send(json.dumps(msg))
        print("Send OK")

asyncio.run(test())
