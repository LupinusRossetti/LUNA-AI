# generator_ab.py
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

MODEL          = os.getenv("MODEL")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

PROMPT_FILE_AB = os.getenv("PROMPT_FILE_AB")

TAG_A = os.getenv("TAG_A", "A")
TAG_B = os.getenv("TAG_B", "B")
LIMIT_AB = int(os.getenv("LIMIT_AB", 500))

genai.configure(api_key=GOOGLE_API_KEY)


class GeneratorAB:
    def __init__(self):
        self.model = genai.GenerativeModel(MODEL)
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

        # Gemini に渡す「完全なプロンプト」
        prompt = (
            self.dual_prompt
            + "\n\n"
            + "【会話履歴】\n"
            + "\n".join(self.history)
            + "\n\n"
            + "【制約】上記履歴の続きとして、A/B の掛け合いを XML のみで生成してください。"
        )

        # ストリームを返す
        return self.model.generate_content(prompt, stream=True)
