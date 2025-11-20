export const characterConfig = {
  name: process.env.NEXT_PUBLIC_CHARACTER_NAME || "未設定キャラ",

  aivis: {
    // 話者ID（必須）
    speaker: process.env.NEXT_PUBLIC_AIVIS_SPEECH_SPEAKER || "",

    // AivisSpeech 基本パラメータ
    speed: parseFloat(process.env.NEXT_PUBLIC_AIVIS_SPEECH_SPEED || "1.0"),
    pitch: parseFloat(process.env.NEXT_PUBLIC_AIVIS_SPEECH_PITCH || "0"),
    intonation: parseFloat(process.env.NEXT_PUBLIC_AIVIS_SPEECH_INTONATION_SCALE || "1.0"),
    tempoDynamics: parseFloat(process.env.NEXT_PUBLIC_AIVIS_SPEECH_TEMPO_DYNAMICS || "1.0"),
    prePhoneme: parseFloat(process.env.NEXT_PUBLIC_AIVIS_SPEECH_PRE_PHONEME_LENGTH || "0.1"),
    postPhoneme: parseFloat(process.env.NEXT_PUBLIC_AIVIS_SPEECH_POST_PHONEME_LENGTH || "0.1"),

    // サーバー URL
    serverUrl: process.env.AIVIS_SPEECH_SERVER_URL || "http://localhost:10101",
  },

  // SYSTEM_PROMPT を env で切替
  systemPrompt: process.env.NEXT_PUBLIC_SYSTEM_PROMPT || "",
};
