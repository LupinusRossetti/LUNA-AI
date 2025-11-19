import time
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

# 共通設定
from youtube_oauth_settings import CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, SCOPES
from youtube_oauth_settings import CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, SCOPES
YOUTUBE_BROADCAST_ID = ""  # start_youtube_ai.py により書き換えられる


def get_youtube_service():
    creds = Credentials(
        token=None,
        refresh_token=REFRESH_TOKEN,
        token_uri='https://oauth2.googleapis.com/token',
        client_id=CLIENT_ID,
        client_secret=CLIENT_SECRET,
        scopes=SCOPES
    )
    creds.refresh(Request())
    return build("youtube", "v3", credentials=creds)


def post_message(message):
    youtube = get_youtube_service()

    response = youtube.liveChatMessages().insert(
        part="snippet",
        body={
            "snippet": {
                "liveChatId": YOUTUBE_BROADCAST_ID,
                "type": "textMessageEvent",
                "textMessageDetails": {"messageText": message}
            }
        }
    ).execute()

    print("送信:", message)
