import asyncio
import websockets
import json

connected = set()

async def handler(ws):
    print("Client connected")
    connected.add(ws)

    try:
        async for message in ws:
            print("Received:", message)

            # --- 全クライアント（except self）に中継 ---
            for client in connected:
                if client != ws:
                    await client.send(message)

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

    finally:
        connected.remove(ws)

async def main():
    print("WebSocket server running ws://localhost:8000/ws ...")
    async with websockets.serve(handler, "localhost", 8000):
        await asyncio.Future()  # run forever

asyncio.run(main())
