import asyncio
import json
import websockets
import requests


class AITuberKitClient:
    def __init__(self, base_url, ws_url):
        self.base_url = base_url
        self.ws_url = ws_url
        self.ws = None
        self.latest_message = None

    async def connect(self):
        print("Connecting WS:", self.ws_url)
        self.ws = await websockets.connect(self.ws_url)
        asyncio.create_task(self.receiver_loop())

    async def receiver_loop(self):
        async for message in self.ws:
            data = json.loads(message)
            if "text" in data:
                self.latest_message = data["text"]

    def get_latest_message(self):
        msg = self.latest_message
        self.latest_message = None
        return msg

    def send_message(self, text: str):
        url = f"{self.base_url}/api/external/chat"
        requests.post(url, json={"text": text})
