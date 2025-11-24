# generator_ab.py
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

MODEL          = os.getenv("MODEL")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

PROMPT_FILE_AB = os.getenv("PROMPT_FILE_AB")

# A / B の識別子（履歴に積む用）
TAG_A = os.getenv("TAG_A", "A")
TAG_B = os.getenv("TAG_B", "B")

# 文字数制限（履歴側のトリミング用）
LIMIT_AB = int(os.getenv("LIMIT_AB", 500))

genai.configure(api_key=GOOGLE_API_KEY)


class GeneratorAB:
    """
    ・A/B の会話履歴を組み立てて Gemini に投げるだけのクラス
    ・返ってきた内容は XML（<A emotion="...">...</A>）で、
      その解析は ws_router.py 側で行う
    """

    def __init__(self):
        self.model = genai.GenerativeModel(MODEL)
        self.tagA = TAG_A
        self.tagB = TAG_B

        with open(PROMPT_FILE_AB, "r", encoding="utf-8") as f:
            self.dual_prompt = f.read()

        # "A: xxx" / "B: yyy" の履歴
        self.history: list[str] = []

    def detect_speaker(self, source: str) -> str:
        """
        Web 側から飛んでくる source ("A" or "B") を
        そのまま TAG_A / TAG_B にマッピング
        """
        if source == "A":
            return self.tagA
        if source == "B":
            return self.tagB
        # 想定外はとりあえず A に寄せる
        return self.tagA

    def build_input(self, speaker_tag: str, text: str) -> str:
        """
        プロンプト側のルール：
        A: ユーザー発話
        B: ユーザー発話
        """
        return f"{speaker_tag}: {text}"

    def run(self, text: str, source: str):
        # 話し手判定
        speaker = self.detect_speaker(source)

        # 履歴に追加
        user_turn = self.build_input(speaker, text)
        self.history.append(user_turn)

        # 履歴の長さ制御：簡易に total length でトリミング
        joined = "\n".join(self.history)
        if len(joined) > LIMIT_AB:
            while len("\n".join(self.history)) > LIMIT_AB and len(self.history) > 1:
                self.history.pop(0)

        prompt = self.dual_prompt + "\n\n" + "\n".join(self.history)

        # stream=True でストリームを返す
        response = self.model.generate_content(prompt, stream=True)
        return response
