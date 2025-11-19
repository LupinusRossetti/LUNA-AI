import time
from aituber_chat_poster import post_message, YOUTUBE_BROADCAST_ID


class YouTubeClient:
    def fetch_chat_messages(self):
        # ★ フェーズ1では簡易化（後で実装）
        # 必要なら長時間稼働版のchat fetcherを後で作る
        return []

    def post_message(self, text):
        post_message(text)
