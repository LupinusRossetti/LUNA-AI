import sys
import os
import re
import argparse

from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from youtube_oauth_settings import CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, SCOPES


ENV_A_PATH = r".env.A"
ENV_B_PATH = r".env.B"
REFRESH_TOKEN_PATH = "refresh_token.txt"


# ---------------------------------------------
# OAuth 認証フロー（--auth）
# ---------------------------------------------
def run_auth_flow():
    print("===== YouTube OAuth 認証フロー開始 =====")

    flow = InstalledAppFlow.from_client_config(
        {
            "installed": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "redirect_uris": ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        },
        scopes=SCOPES,
    )

    creds = flow.run_local_server(port=0)

    refresh_token = creds.refresh_token

    if not refresh_token:
        print("❌ refresh_token が取得できませんでした。")
        sys.exit(1)

    with open(REFRESH_TOKEN_PATH, "w", encoding="utf-8") as f:
        f.write(refresh_token)

    print("✅ OAuth 認証成功！ refresh_token を保存しました:", refresh_token)
    print("このウィンドウは閉じても大丈夫です。")
    sys.exit(0)


# ---------------------------------------------
# LIVE ID 取得
# ---------------------------------------------
def get_live_broadcast_id(refresh_token):
    try:
        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=CLIENT_ID,
            client_secret=CLIENT_SECRET,
            scopes=SCOPES
        )
        creds.refresh(Request())
        youtube = build('youtube', 'v3', credentials=creds)

        response = youtube.liveBroadcasts().list(
            part="id,status,snippet",
            mine=True,
            maxResults=50
        ).execute()

        for item in response.get("items", []):
            status = item.get("status", {}).get("lifeCycleStatus", "")
            if status in ["live", "ready", "testing", "upcoming"]:
                return item["id"]

        return ""
    except Exception as e:
        print("ERROR:", e)
        return ""


# ---------------------------------------------
# .env 更新
# ---------------------------------------------
def update_env(path, live_id):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as f:
        txt = f.read()

    txt = re.sub(
        r'NEXT_PUBLIC_YOUTUBE_LIVE_ID\s*=\s*".*?"',
        f'NEXT_PUBLIC_YOUTUBE_LIVE_ID="{live_id}"',
        txt
    )

    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)


# ---------------------------------------------
# メイン
# ---------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--auth", action="store_true")
    args = parser.parse_args()

    # 1) 認証フロー
    if args.auth:
        run_auth_flow()

    # 2) refresh_token 読み込み
    if os.path.exists(REFRESH_TOKEN_PATH):
        with open(REFRESH_TOKEN_PATH, "r", encoding="utf-8") as f:
            refresh_token = f.read().strip()
    else:
        refresh_token = REFRESH_TOKEN

    # 3) LIVE ID 取得
    live_id = get_live_broadcast_id(refresh_token)
    if not live_id:
        print("❌ LIVE ID を取得できませんでした。")
        sys.exit(1)

    update_env(ENV_A_PATH, live_id)
    update_env(ENV_B_PATH, live_id)

    print("LIVE ID:", live_id)
    sys.stdout.write(live_id)
