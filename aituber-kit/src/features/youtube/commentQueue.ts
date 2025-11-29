/**
 * コメントキュー操作のユーティリティ関数
 */

import { QueuedComment } from '@/features/stores/commentQueueStore'
import { commentQueueStore } from '@/features/stores/commentQueueStore'
import { projectModeStore, ProjectState } from '@/features/stores/projectModeStore'

/**
 * コメントをキューに追加する（モード別のルールに従う）
 */
export const enqueueCommentByMode = (comment: QueuedComment): boolean => {
  const { currentMode, projectState } = projectModeStore.getState()
  
  // 通常モード
  if (currentMode === 'normal') {
    if (comment.prefixType === 'character') {
      // IR/FI: 高優先度でキューに追加
      commentQueueStore.getState().enqueueComment(comment)
      return true
    } else if (comment.prefixType === 'project-proposal') {
      // #xx: 低優先度でキューに追加
      commentQueueStore.getState().enqueueComment(comment)
      return true
    }
    // /xx と接頭辞なしは破棄
    return false
  }
  
  // 提案待機中
  if (projectState === 'proposalPending') {
    if (comment.prefixType === 'character') {
      // IR/FI: 高優先度でキューに追加（キューに残したまま）
      commentQueueStore.getState().enqueueComment(comment)
      return true
    } else if (comment.prefixType === 'project-proposal') {
      // #xx: 低優先度でキューに追加（キューに残したまま）
      commentQueueStore.getState().enqueueComment(comment)
      return true
    }
    // /xx と接頭辞なしは破棄
    return false
  }
  
  // 企画紹介中
  if (projectState === 'projectIntro') {
    // 全てのコメントを破棄
    return false
  }
  
  // 企画実行中
  if (projectState === 'projectRunning') {
    if (comment.prefixType === 'project-command') {
      // /xx: キューに追加
      commentQueueStore.getState().enqueueProjectCommand(comment)
      return true
    }
    // IR/FI、#xx、接頭辞なしは破棄（一部企画のみ接頭辞なしも可、基本は破棄）
    return false
  }
  
  // 企画リザルト
  if (projectState === 'projectResult') {
    // 全てのコメントを破棄
    return false
  }
  
  return false
}

/**
 * 対応受付中モードになったときに、キューから次のコメントを処理する
 */
export const processNextCommentFromQueue = (): QueuedComment | null => {
  const { currentMode, projectState } = projectModeStore.getState()
  
  // 通常モードまたは提案待機中の場合
  if (currentMode === 'normal' || projectState === 'proposalPending') {
    const nextComment = commentQueueStore.getState().dequeueComment()
    if (nextComment) {
      return nextComment
    }
    
    // 通常コメントキューが空の場合、企画コマンドキューを確認
    const nextProjectCommand = commentQueueStore.getState().dequeueProjectCommand()
    if (nextProjectCommand) {
      return nextProjectCommand
    }
  }
  
  // 企画実行中の場合
  if (projectState === 'projectRunning') {
    const nextProjectCommand = commentQueueStore.getState().dequeueProjectCommand()
    if (nextProjectCommand) {
      return nextProjectCommand
    }
  }
  
  return null
}

/**
 * 企画開始時にキューをクリアする
 */
export const clearQueuesOnProjectStart = () => {
  commentQueueStore.getState().clearAllQueues()
}

/**
 * 企画紹介中に移行したときにキューをクリアする
 */
export const clearQueuesOnProjectIntro = () => {
  commentQueueStore.getState().clearAllQueues()
}

/**
 * 企画リザルトに移行したときにキューをクリアする
 */
export const clearQueuesOnProjectResult = () => {
  commentQueueStore.getState().clearAllQueues()
}

