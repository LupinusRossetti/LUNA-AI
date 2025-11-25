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

# Google検索グラウンディングの設定（環境変数から読み込み、デフォルトはtrue）
USE_SEARCH_GROUNDING = os.getenv("USE_SEARCH_GROUNDING", "true").lower() == "true"

genai.configure(api_key=GOOGLE_API_KEY)


import datetime

class GeneratorAB:
    def __init__(self):
        # Google検索グラウンディングの設定を環境変数から読み込み
        # フロントエンドと同様に、optionsパラメータでuseSearchGroundingを設定
        self.use_search_grounding = USE_SEARCH_GROUNDING
        self.model = genai.GenerativeModel(MODEL)
        if self.use_search_grounding:
            print("Google Search Grounding enabled (will be used via options parameter).")
        else:
            print("Google Search Grounding disabled.")
        self.tagA = TAG_A
        self.tagB = TAG_B

        with open(PROMPT_FILE_AB, "r", encoding="utf-8") as f:
            self.dual_prompt = f.read()

        self.history: list[str] = []

    def detect_speaker(self, source: str) -> str:
        return TAG_A if source == "A" else TAG_B

    def build_input(self, speaker: str, text: str) -> str:
        return f"{speaker}: {text}"

    async def run(self, text: str, source: str):
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

        # サーチグラウンディング用のプロンプト追加指示
        # 検索機能が有効な場合、セリフの後ろに「※検索使用」とつける指示を追加
        search_instruction = ""
        if self.use_search_grounding:
            search_instruction = "\n【重要】検索機能を使用した場合、セリフの最後に「※検索使用」という表記（読み上げない文字）を追加してください。"
        
        prompt = (
            f"Current Time: {now_str}\n\n"
            + self.dual_prompt
            + search_instruction
            + "\n\n"
            + "【会話履歴】\n"
            + "\n".join(self.history)
            + "\n\n"
            + f"【制約】上記履歴の続きとして、A/B の掛け合いを XML のみで生成してください。{start_hint}"
        )

        # 検索指示を含まないプロンプト（フォールバック用）
        fallback_prompt = (
            f"Current Time: {now_str}\n\n"
            + self.dual_prompt
            + "\n\n"
            + "【会話履歴】\n"
            + "\n".join(self.history)
            + "\n\n"
            + f"【制約】上記履歴の続きとして、A/B の掛け合いを XML のみで生成してください。{start_hint}"
        )

        # サーチグラウンディング機能を常に試行し、失敗した場合は通常の会話にフォールバック
        # 重要: エラーが発生しても必ずストリームを返す（会話を継続させるため）
        if self.use_search_grounding:
            try:
                # google_search を試す（ライブラリ／API側の仕様により失敗する可能性あり）
                tools = None
                try:
                    # 方法1: protos形式で Tool オブジェクトを作成
                    tool = genai.protos.Tool()
                    tool.google_search = genai.protos.Tool.GoogleSearch()
                    tools = [tool]
                except (AttributeError, TypeError) as tool_error:
                    # 方法2: 辞書形式を試す
                    print(f"WARNING: Protos format failed, trying dictionary: {tool_error}")
                    tools = [{'google_search': {}}]

                if tools is None:
                    raise ValueError("Failed to create tools")

                # サーチグラウンディング有効で生成
                # 検索指示を含むプロンプトで生成（成功時は「※検索使用」が表示される）
                stream = await self.model.generate_content_async(
                    prompt,
                    tools=tools,
                    stream=True,
                )
                return stream

            except Exception as e:
                # サーチグラウンディングに失敗した場合はログを出し、必ずフォールバックする
                print(f"WARNING: Google Search Grounding failed: {e}")
                print("Falling back to generation WITHOUT search grounding.")
                # 失敗時は検索指示を含まないプロンプトで再生成
                # 「※検索使用」は表示しない（検索機能が使われていないため）
                stream = await self.model.generate_content_async(
                    fallback_prompt,
                    stream=True,
                )
                return stream

        # サーチグラウンディングが無効な場合（または上で失敗した場合のフォールバック）
        stream = await self.model.generate_content_async(
            fallback_prompt,
            stream=True,
        )
        return stream
