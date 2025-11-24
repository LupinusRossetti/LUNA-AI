import asyncio
import websockets
import json
import time

# 設定
WS_URL = "ws://localhost:8765"
WS_A_PATH = f"{WS_URL}/WA" # Iris (Router -> Server -> Iris)
WS_B_PATH = f"{WS_URL}/WB" # Fiona (Router -> Server -> Fiona)

# 擬似的なGemini応答 (XML形式)
MOCK_RESPONSE_XML = """
<A emotion="happy">こんにちは、ルピナスお姉ちゃん！</A>
<B emotion="neutral">あら、今日は随分とご機嫌ね、アイリス。</B>
<A emotion="relaxed">だって、新しい機能のテストができるんだもん！</A>
"""

async def connect_and_listen(uri, name):
    """WebSocketに接続してメッセージを受信するタスク"""
    async with websockets.connect(uri) as ws:
        print(f"[{name}] Connected to {uri}")
        try:
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                print(f"[{name}] Received: {data.get('type')} from {data.get('role')}")
                
                # speech_end を返すシミュレーション（本来はAItuberKitがやる）
                # ここではRouterの挙動テストではなく、RouterになりすましてServerに送るテスト
                # いや、このスクリプトは "Router" の代わりをするべきか？
                # それとも "User" の代わりをして "Router" を動かすべきか？
                
                # 今回の目的：
                # 1. ws_router.py が動いている状態で、
                # 2. ユーザー入力を ws_router.py に送り、
                # 3. ws_router.py が Gemini (Mock) を叩いて、
                # 4. AItuberKit にメッセージが届くか確認したい。
                
                # しかし Gemini Mock は難しいので、
                # このスクリプトは "ws_router.py" の代わりとして動作し、
                # AItuberKit (Browser) に対してメッセージを送るテストにする。
                
                pass
        except websockets.exceptions.ConnectionClosed:
            print(f"[{name}] Connection closed")

async def mock_router_behavior():
    """ws_router.py の代わりとして振る舞うテスト"""
    print("--- Mock Router Test ---")
    print("Please ensure 'simple_ws_server.py' is running.")
    print("Please ensure AItuberKit tabs are open (Port 3000/3001).")
    
    # 1. WA (Iris用) に接続
    async with websockets.connect(WS_A_PATH) as ws_a:
        print("[Mock] Connected to /WA")
        
        # 2. WB (Fiona用) に接続
        async with websockets.connect(WS_B_PATH) as ws_b:
            print("[Mock] Connected to /WB")
            
            # 3. メッセージ送信テスト (Iris)
            print("[Mock] Sending to Iris...")
            turn_id = 1
            payload_a = {
                "type": "message",
                "role": "assistant",
                "text": "テストです。アイリス、聞こえますか？",
                "emotion": "happy",
                "meta": {"character": "A", "turnId": turn_id}
            }
            await ws_a.send(json.dumps(payload_a, ensure_ascii=False))
            
            # 4. speech_end 待機 (Iris)
            print("[Mock] Waiting for speech_end from Iris...")
            while True:
                resp = await ws_a.recv()
                data = json.loads(resp)
                if data.get("type") == "speech_end" and data.get("turnId") == turn_id:
                    print("[Mock] Received speech_end from Iris!")
                    break
                else:
                    print(f"[Mock] Ignored: {data}")

            # 5. メッセージ送信テスト (Fiona)
            print("[Mock] Sending to Fiona...")
            turn_id = 2
            payload_b = {
                "type": "message",
                "role": "assistant",
                "text": "こちらフィオナ。音声回路、正常です。",
                "emotion": "neutral",
                "meta": {"character": "B", "turnId": turn_id}
            }
            await ws_b.send(json.dumps(payload_b, ensure_ascii=False))
            
            # 6. speech_end 待機 (Fiona)
            print("[Mock] Waiting for speech_end from Fiona...")
            while True:
                resp = await ws_b.recv()
                data = json.loads(resp)
                if data.get("type") == "speech_end" and data.get("turnId") == turn_id:
                    print("[Mock] Received speech_end from Fiona!")
                    break
                else:
                    print(f"[Mock] Ignored: {data}")

    print("--- Test Complete ---")

if __name__ == "__main__":
    try:
        asyncio.run(mock_router_behavior())
    except Exception as e:
        print(f"Error: {e}")
        print("Make sure simple_ws_server.py is running!")
