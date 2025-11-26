import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Message } from "@/features/messages/messages";
import { Viewer } from "../vrmViewer/viewer";
import { messageSelectors } from "../messages/messageSelectors";
import { generateMessageId } from "@/utils/messageUtils";

export interface PersistedState {
  userOnboarded: boolean;
  chatLog: Message[];
  showIntroduction: boolean;
}

export interface TransientState {
  viewer: Viewer;
  live2dViewer: any; // レガシー対応（単体モード用）
  live2dViewerA: any; // 掛け合いモード用: キャラクターA（アイリス）
  live2dViewerB: any; // 掛け合いモード用: キャラクターB（フィオナ）
  slideMessages: string[];
  chatProcessing: boolean;
  chatProcessingCount: number;
  incrementChatProcessingCount: () => void;
  decrementChatProcessingCount: () => void;
  upsertMessage: (message: Partial<Message>) => void;
  backgroundImageUrl: string;
  modalImage: string;
  triggerShutter: boolean;
  webcamStatus: boolean;
  captureStatus: boolean;
  isCubismCoreLoaded: boolean;
  setIsCubismCoreLoaded: (loaded: boolean) => void;
  isLive2dLoaded: boolean;
  setIsLive2dLoaded: (loaded: boolean) => void;
  isSpeaking: boolean;

  onAIAssistantReply: (listener: (msg: Message) => void) => void;
  emitAIAssistantReply: (msg: Message) => void;
}

export type HomeState = PersistedState & TransientState;

// ======================================================================
// AI返信（外部向け）フック
// ======================================================================
let externalReplyListeners: Array<(msg: Message) => void> = [];

function onAIAssistantReply(listener: (msg: Message) => void) {
  externalReplyListeners.push(listener);
}

function emitAIAssistantReply(msg: Message) {
  for (const l of externalReplyListeners) {
    try {
      l(msg);
    } catch (e) {
      console.error("External reply listener error:", e);
    }
  }
}

// ======================================================================
// homeStore 本体
// ======================================================================

const homeStore = create<HomeState>()(
  persist(
    (set, get) => ({
      // ===============================
      // 永続化される状態
      // ===============================
      userOnboarded: false,
      chatLog: [],
      showIntroduction: process.env.NEXT_PUBLIC_SHOW_INTRODUCTION !== "false",

      // ===============================
      // 一時状態
      // ===============================
      viewer: new Viewer(),
      live2dViewer: null, // レガシー対応（単体モード用）
      live2dViewerA: null, // 掛け合いモード用: キャラクターA（アイリス）
      live2dViewerB: null, // 掛け合いモード用: キャラクターB（フィオナ）
      slideMessages: [],
      chatProcessing: false,
      chatProcessingCount: 0,

      onAIAssistantReply,
      emitAIAssistantReply,

      incrementChatProcessingCount: () => {
        set(({ chatProcessingCount }) => ({
          chatProcessingCount: chatProcessingCount + 1,
        }));
      },

      decrementChatProcessingCount: () => {
        set(({ chatProcessingCount }) => ({
          chatProcessingCount: Math.max(0, chatProcessingCount - 1),
        }));
      },

      // ====================================================================
      // 🔥 upsertMessage – 外部AI同期用に完全最適化
      // ====================================================================
      upsertMessage: (message) => {
        set((state) => {
          const ss = require("@/features/stores/settings").default.getState();
          const current = state.chatLog;

          // 外部AIモード → handlers.ts で整形済みの最終行をそのまま使う
          if (ss.externalLinkageMode) {
            if (!message.role || message.content == null) {
              return { chatLog: current };
            }

            const newMsg: Message = {
              id: generateMessageId(),
              role: message.role,
              content: message.content,
            };

            return { chatLog: [...current, newMsg] };
          }

          // =====================================
          // 内部AIモード（旧仕様維持）
          // =====================================
          if (!message.role || message.content === undefined) {
            return { chatLog: current };
          }

          const newMessage: Message = {
            id: generateMessageId(),
            role: message.role,
            content: message.content,
          };
          return { chatLog: [...current, newMessage] };
        });
      },

      // ==========================
      // 各種ステータス
      // ==========================
      backgroundImageUrl:
        process.env.NEXT_PUBLIC_BACKGROUND_IMAGE_PATH ??
        "/backgrounds/bg-c.png",

      modalImage: "",
      triggerShutter: false,
      webcamStatus: false,
      captureStatus: false,

      isCubismCoreLoaded: false,
      setIsCubismCoreLoaded: (loaded) =>
        set(() => ({ isCubismCoreLoaded: loaded })),

      isLive2dLoaded: false,
      setIsLive2dLoaded: (loaded) =>
        set(() => ({ isLive2dLoaded: loaded })),

      isSpeaking: false,
    }),

    {
      name: "aitube-kit-home",

      // 永続化対象を最小限に
      partialize: ({ chatLog, showIntroduction }) => ({
        chatLog: messageSelectors.cutImageMessage(chatLog),
        showIntroduction,
      }),

      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log(
            "Rehydrated chat log:",
            state.chatLog?.length ?? 0
          );
        }
      },
    }
  )
);

// ======================================================================
// 🔥 チャットログ保存 – 外部AI同期中は完全停止
// ======================================================================
homeStore.subscribe((state, prev) => {
  const ss = require("@/features/stores/settings").default.getState();

  // 外部AI同期 → 保存 OFF
  if (ss.externalLinkageMode) return;

  // 内部AIモード時のみ保存
  if (state.chatLog !== prev.chatLog && state.chatLog.length > 0) {
    console.log("[save-chat-log] (internal AI only)");
    void fetch("/api/save-chat-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: state.chatLog.map((m) =>
          messageSelectors.sanitizeMessageForStorage(m)
        ),
      }),
    });
  }
});

export default homeStore;
export { onAIAssistantReply, emitAIAssistantReply };
