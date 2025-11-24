# generator_normal.py
import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

MODEL = os.getenv("MODEL")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
PROMPT_FILE_A = os.getenv("PROMPT_FILE_A")
PROMPT_FILE_B = os.getenv("PROMPT_FILE_B")
CHAR_PREFIX_A = os.getenv("CHAR_PREFIX_A")
CHAR_PREFIX_B = os.getenv("CHAR_PREFIX_B")

genai.configure(api_key=GOOGLE_API_KEY)


class GeneratorNormal:
    def __init__(self):
        self.model = genai.GenerativeModel(MODEL)

        self.prefixA = CHAR_PREFIX_A
        self.prefixB = CHAR_PREFIX_B

        self.promptA = open(PROMPT_FILE_A, "r", encoding="utf-8").read()
        self.promptB = open(PROMPT_FILE_B, "r", encoding="utf-8").read()

    def detect_role(self, text: str):
        if text.startswith(self.prefixA):
            return "A", text[len(self.prefixA):].lstrip()
        if text.startswith(self.prefixB):
            return "B", text[len(self.prefixB):].lstrip()
        return None, text

    def run(self, text: str, source: str):
        # source=A/B で決定
        if source == "A":
            system_prompt = self.promptA
        else:
            system_prompt = self.promptB

        response = self.model.generate_content(
            system_prompt + "\n\nUser: " + text,
            stream=True
        )
        return response
