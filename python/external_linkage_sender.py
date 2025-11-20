import json
import websocket  # pip install websocket-client

def send_to_aituber(
    text: str,
    emotion: str = "neutral",
    role: str = "assistant",
    msg_type: str = "message",
    ws_url: str = "ws://localhost:8000/ws"
):
    payload = {
        "text": text,
        "role": role,
        "emotion": emotion,
        "type": msg_type
    }

    ws = websocket.create_connection(ws_url, timeout=10)
    ws.send(json.dumps(payload, ensure_ascii=False))
    ws.close()

if __name__ == "__main__":
    send_to_aituber("フィオナだよ〜！今度こそ絶対に喋るよ🌸", emotion="happy")
