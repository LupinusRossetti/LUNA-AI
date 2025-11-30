import { create } from 'zustand'

/**
 * キューに格納されるコメントの型定義
 */
export interface QueuedComment {
  id: string // 一意のID（タイムスタンプ + ランダム文字列）
  timestamp: number // キューに入った時刻
  userName: string // リスナー名
  userIconUrl?: string // アイコンURL（オプション）
  comment: string // コメント本文（元のコメント全文）
  characterId?: 'A' | 'B' // キャラクターID（IR/FIコメントの場合）
  message: string // 接頭辞を除去したメッセージ
  priority: 'high' | 'low' // 優先度（IR/FI = high, #xx = low）
  prefixType: 'character' | 'project-proposal' | 'project-command' | 'none' // 接頭辞タイプ
  prefix: string // 検出された接頭辞（例: "IR", "#NZ", "/NZ"）
  youtubeCommentId?: string // YouTubeのコメントID（重複防止用）
}

/**
 * コメントキューストアの状態
 */
interface CommentQueueState {
  // キュー
  commentQueue: QueuedComment[] // IR/FI接頭辞付きの通常コメント
  projectQueue: QueuedComment[] // 企画提案（#xx）や企画コマンド（/xx）

  // 処理済みコメントID（重複防止用）
  processedCommentIds: Set<string>

  // アクション
  enqueueComment: (comment: QueuedComment) => void
  dequeueComment: () => QueuedComment | undefined
  enqueueProjectCommand: (command: QueuedComment) => void
  dequeueProjectCommand: () => QueuedComment | undefined
  clearCommentQueue: () => void
  clearProjectQueue: () => void
  clearAllQueues: () => void

  // 同じリスナーからの回答の最新のみ保持（企画実行中専用）
  updateListenerAnswer: (listenerName: string, comment: QueuedComment) => void
  getListenerAnswer: (listenerName: string) => QueuedComment | undefined
  getAllListenerAnswers: () => QueuedComment[]
  clearListenerAnswers: () => void
}

// 同じリスナーからの回答を管理するマップ（企画実行中専用）
const listenerAnswerMap = new Map<string, QueuedComment>()

export const commentQueueStore = create<CommentQueueState>((set, get) => ({
  // 初期状態
  commentQueue: [],
  projectQueue: [],

  // 処理済みコメントID（重複防止用）
  processedCommentIds: new Set<string>(),

  // 通常コメントをキューに追加（高優先度は先頭に、低優先度は末尾に）
  enqueueComment: (comment) => {
    set((state) => {
      // 重複チェック
      if (comment.youtubeCommentId && state.processedCommentIds.has(comment.youtubeCommentId)) {
        console.log('[commentQueueStore] 重複コメントのため無視:', comment.youtubeCommentId)
        return {}
      }

      // 最大100件に制限
      const maxSize = 100
      let newQueue = [...state.commentQueue]

      if (comment.priority === 'high') {
        // 高優先度は先頭に挿入
        newQueue = [comment, ...newQueue]
      } else {
        // 低優先度は末尾に追加
        newQueue = [...newQueue, comment]
      }

      // 最大サイズを超えた場合は古いものを削除
      if (newQueue.length > maxSize) {
        newQueue = newQueue.slice(0, maxSize)
      }

      // IDを記録
      const newProcessedIds = new Set(state.processedCommentIds)
      if (comment.youtubeCommentId) {
        newProcessedIds.add(comment.youtubeCommentId as string)
        // Setのサイズも制限（メモリリーク防止）
        if (newProcessedIds.size > 1000) {
          const iterator = newProcessedIds.values()
          for (let i = 0; i < 100; i++) {
            newProcessedIds.delete(iterator.next().value)
          }
        }
      }

      return { commentQueue: newQueue, processedCommentIds: newProcessedIds }
    })
  },

  // 通常コメントをキューから取り出す（高優先度を優先、同じ優先度内ではFIFO）
  dequeueComment: () => {
    const state = get()
    if (state.commentQueue.length === 0) {
      return undefined
    }

    // 高優先度のコメントを先に探す
    const highPriorityIndex = state.commentQueue.findIndex(c => c.priority === 'high')
    if (highPriorityIndex !== -1) {
      const [comment] = state.commentQueue.splice(highPriorityIndex, 1)
      set({ commentQueue: [...state.commentQueue] })
      return comment
    }

    // 高優先度がない場合は先頭（最古）を取り出す
    const [comment, ...rest] = state.commentQueue
    set({ commentQueue: rest })
    return comment
  },

  // 企画コマンドをキューに追加（末尾に追加）
  enqueueProjectCommand: (command) => {
    set((state) => {
      // 重複チェック
      if (command.youtubeCommentId && state.processedCommentIds.has(command.youtubeCommentId)) {
        return {}
      }

      const maxSize = 100
      const newQueue = [...state.projectQueue, command]

      // IDを記録
      const newProcessedIds = new Set(state.processedCommentIds)
      if (command.youtubeCommentId) {
        newProcessedIds.add(command.youtubeCommentId)
      }

      if (newQueue.length > maxSize) {
        return { projectQueue: newQueue.slice(0, maxSize), processedCommentIds: newProcessedIds }
      }

      return { projectQueue: newQueue, processedCommentIds: newProcessedIds }
    })
  },

  // 企画コマンドをキューから取り出す（FIFO）
  dequeueProjectCommand: () => {
    const state = get()
    if (state.projectQueue.length === 0) {
      return undefined
    }

    const [command, ...rest] = state.projectQueue
    set({ projectQueue: rest })
    return command
  },

  // 通常コメントキューをクリア
  clearCommentQueue: () => {
    set({ commentQueue: [] })
  },

  // 企画コマンドキューをクリア
  clearProjectQueue: () => {
    set({ projectQueue: [] })
  },

  // 全てのキューをクリア
  clearAllQueues: () => {
    set({ commentQueue: [], projectQueue: [] })
    listenerAnswerMap.clear()
  },

  // 同じリスナーからの回答を更新（最新のみ保持）
  updateListenerAnswer: (listenerName, comment) => {
    listenerAnswerMap.set(listenerName, comment)
  },

  // リスナーの回答を取得
  getListenerAnswer: (listenerName) => {
    return listenerAnswerMap.get(listenerName)
  },

  // 全てのリスナーの回答を取得
  getAllListenerAnswers: () => {
    return Array.from(listenerAnswerMap.values())
  },

  // リスナーの回答をクリア
  clearListenerAnswers: () => {
    listenerAnswerMap.clear()
  },
}))


