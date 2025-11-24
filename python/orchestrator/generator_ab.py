# generator_ab.py
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

MODEL          = os.getenv("MODEL", "gemini-2.0-flash-exp")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# プロンプトファイルのデフォルトパスを修正
PROMPT_FILE_AB = os.getenv("PROMPT_FILE_AB", "orchestrator/prompts/aibs_dual.txt")

TAG_A = os.getenv("TAG_A", "A")
TAG_B = os.getenv("TAG_B", "B")
LIMIT_AB = int(os.getenv("LIMIT_AB", 500))

genai.configure(api_key=GOOGLE_API_KEY)


import datetime

class GeneratorAB:
    def __init__(self):
        # サーチグラウンディング有効化を試みたが、google-generativeai 0.8.5 では
        # 複数のフィールド名 (google_search_retrieval, google_search) を試しても
        # ValueError が発生するため、一時的に無効化
        # 代わりにシステムプロンプトに現在日時を注入することで日付関連の質問に対応
        # self.tools = [
        #     {'google_search': {}}
        # ]
        self.model = genai.GenerativeModel(
            MODEL,
            # tools=self.tools  # 一時的に無効化
        )
        self.tagA = TAG_A
        self.tagB = TAG_B

        with open(PROMPT_FILE_AB, "r", encoding="utf-8") as f:
            self.dual_prompt = f.read()

        self.history: list[str] = []

    def detect_speaker(self, source: str) -> str:
        return TAG_A if source == "A" else TAG_B

    def build_input(self, speaker: str, text: str) -> str:
        return f"{speaker}: {text}"

    def run(self, text: str, source: str):
        speaker = self.detect_speaker(source)

        user_turn = self.build_input(speaker, text)
        self.history.append(user_turn)

        # トリミング
        joined = "\n".join(self.history)
        if len(joined) > LIMIT_AB:
            while len("\n".join(self.history)) > LIMIT_AB:
                self.history.pop(0)

        # 現在日時を取得
        now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Gemini に渡す「完全なプロンプト」
        # source に応じて開始キャラを明示
        start_hint = f"※{speaker}から掛け合いを開始してください。"
        
        prompt = (
            f"Current Time: {now_str}\n\n"
            + self.dual_prompt
            + "\n\n"
            + "【会話履歴】\n"
            + "\n".join(self.history)
            + "\n\n"
            + f"【制約】上記履歴の続きとして、A/B の掛け合いを XML のみで生成してください。{start_hint}"
        )

        # ストリームを返す (非同期)
        return self.model.generate_content_async(prompt, stream=True)
