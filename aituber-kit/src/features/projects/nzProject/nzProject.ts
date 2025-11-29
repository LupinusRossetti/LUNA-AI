/**
 * なぞなぞ企画の実装
 */

import { ProjectBase } from '../projectTypes'
import { projectManager, startProject, endProject, approveProject, rejectProject, handleProjectProposal, handleProjectCommand } from '../projectBase'
import { NZ_PROPOSAL_PENDING_SCRIPT, NZ_INTRO_SCRIPT, NZ_RESULT_SCRIPT, REJECTION_SCRIPT, sendScript } from '../projectScripts'
import { processAIResponse } from '@/features/chat/handlers'
import { Message } from '@/features/messages/messages'
import { RIDDLES, Riddle, getRandomRiddle, getRandomRiddleByCategory } from './data'
import { generateRiddleWithSearchGrounding } from './riddleGenerator'
import { commentQueueStore } from '@/features/stores/commentQueueStore'
import { projectModeStore } from '@/features/stores/projectModeStore'
import { isAffirmative, isNegative } from '../approvalDetector'
import homeStore from '@/features/stores/home'
import { playProjectStartEffects, playCorrectEffects, playIncorrectEffects } from './effects'

/**
 * なぞなぞ企画の状態
 */
interface NZProjectState {
  currentRiddle: Riddle | null
  currentRiddleIndex: number
  startTime: number | null
  lastHintTime: number | null
  listenerAnswers: Map<string, { answer: string, timestamp: number }> // リスナー名 -> 回答
  hintIntervalId: number | null // ヒント用のインターバルID（ブラウザ環境ではnumber）
}

// なぞなぞ企画の状態
let nzState: NZProjectState = {
  currentRiddle: null,
  currentRiddleIndex: -1,
  startTime: null,
  lastHintTime: null,
  listenerAnswers: new Map(),
  hintIntervalId: null,
}


/**
 * なぞなぞ企画の実装
 */
export const nzProject: ProjectBase = {
  id: 'nz',
  name: 'なぞなぞ企画',
  description: 'みんなでなぞなぞに挑戦しよう！',
  proposalPrefix: '#NZ',
  commandPrefix: '/NZ',
  
  // 企画提案を受信したとき
  onProposalReceived: async (listenerName, message) => {
    console.log('[nzProject] 企画提案を受信:', listenerName, message)
    await sendScript(NZ_PROPOSAL_PENDING_SCRIPT)
  },
  
  // 企画を承認したとき
  onApproved: async () => {
    console.log('[nzProject] 企画を承認')
    // startProject内でonIntroが呼ばれる
  },
  
  // 企画を拒否したとき
  onRejected: async () => {
    console.log('[nzProject] 企画を拒否')
    await sendScript(REJECTION_SCRIPT)
  },
  
  // 企画紹介中
  onIntro: async () => {
    console.log('[nzProject] 企画紹介')
    await sendScript(NZ_INTRO_SCRIPT)
  },
  
  // 企画開始
  onStart: async () => {
    console.log('[nzProject] 企画開始')
    
    // 状態をリセット
    nzState = {
      currentRiddle: null,
      currentRiddleIndex: -1,
      startTime: Date.now(),
      lastHintTime: null,
      listenerAnswers: new Map(),
      hintIntervalId: null,
    }
    
    // サーチグラウンディングでなぞなぞを自動生成
    let riddle: Riddle | null = null
    
    try {
      riddle = await generateRiddleWithSearchGrounding()
      console.log('[nzProject] サーチグラウンディングでなぞなぞを生成:', riddle)
    } catch (error) {
      console.error('[nzProject] なぞなぞ生成エラー:', error)
    }
    
    // 生成に失敗した場合は、既存の問題からランダムに選択
    if (!riddle) {
      console.log('[nzProject] 既存の問題から選択します')
      riddle = getRandomRiddle()
    }
    
    nzState.currentRiddle = riddle
    nzState.currentRiddleIndex = 0
    
    // なぞなぞを出題
    const questionScript = `<A emotion="happy">第1問！ ${riddle.question}</A>
<B emotion="relaxed">みなさん、/NZの後に答えを書いて送信してくださいね。</B>`
    await sendScript(questionScript)
    
    // 企画開始時のエフェクトを実行
    await playProjectStartEffects()
    
    // ヒント機能のインターバルを開始（2分ごと）
    startHintInterval()
  },
  
  // 企画コマンドを受信したとき
  onCommand: async (listenerName, command, message) => {
    console.log('[nzProject] 企画コマンドを受信:', listenerName, command, message)
    
    if (!nzState.currentRiddle) {
      console.warn('[nzProject] 現在なぞなぞが設定されていません')
      return
    }
    
    // 回答を保存（同じリスナーからの回答は最新のみ保持）
    const answer = message.trim()
    nzState.listenerAnswers.set(listenerName, {
      answer,
      timestamp: Date.now(),
    })
    
    // キューにも保存（企画リザルトで使用）
    const queuedComment = commentQueueStore.getState().getAllListenerAnswers().find(
      c => c.userName === listenerName
    )
    
    if (!queuedComment) {
      // キューに追加（企画リザルトで使用）
      commentQueueStore.getState().updateListenerAnswer(listenerName, {
        id: `answer_${Date.now()}_${listenerName}`,
        timestamp: Date.now(),
        userName: listenerName,
        comment: `/NZ ${answer}`,
        message: answer,
        priority: 'low',
        prefixType: 'project-command',
        prefix: '/NZ',
      })
    } else {
      // 既存の回答を更新
      commentQueueStore.getState().updateListenerAnswer(listenerName, {
        ...queuedComment,
        message: answer,
        comment: `/NZ ${answer}`,
        timestamp: Date.now(),
      })
    }
    
    console.log('[nzProject] 回答を保存:', listenerName, answer)
    
    // 正解/不正解を判定してエフェクトを実行
    const normalizedAnswer = answer.toLowerCase()
    const normalizedCorrect = nzState.currentRiddle.answer.toLowerCase()
    
    if (normalizedAnswer === normalizedCorrect) {
      // 正解
      await playCorrectEffects()
    } else {
      // 不正解
      await playIncorrectEffects()
    }
  },
  
  // 企画リザルト
  onResult: async () => {
    console.log('[nzProject] 企画リザルト')
    
    if (!nzState.currentRiddle) {
      console.warn('[nzProject] 現在なぞなぞが設定されていません')
      return
    }
    
    // 全ての回答を取得
    const allAnswers = commentQueueStore.getState().getAllListenerAnswers()
    
    // 正解/不正解を判定
    const correctAnswers: string[] = []
    const incorrectAnswers: { listenerName: string, answer: string }[] = []
    
    for (const answer of allAnswers) {
      const normalizedAnswer = answer.message.trim().toLowerCase()
      const normalizedCorrect = nzState.currentRiddle.answer.toLowerCase()
      
      if (normalizedAnswer === normalizedCorrect) {
        correctAnswers.push(answer.userName)
      } else {
        incorrectAnswers.push({
          listenerName: answer.userName,
          answer: answer.message,
        })
      }
    }
    
    // 結果発表のセリフを生成
    let resultScript = NZ_RESULT_SCRIPT
    
    if (correctAnswers.length > 0) {
      resultScript += `\n<A emotion="happy">正解した人は、${correctAnswers.join('さん、')}さんです！</A>`
    }
    
    if (incorrectAnswers.length > 0) {
      const sampleIncorrect = incorrectAnswers.slice(0, 3) // 最大3件
      resultScript += `\n<B emotion="relaxed">不正解だった方も、次回は頑張ってくださいね。</B>`
    }
    
    await sendScript(resultScript)
  },
  
  // 企画終了
  onEnd: async () => {
    console.log('[nzProject] 企画終了')
    
    // ヒントインターバルをクリア
    if (nzState.hintIntervalId) {
      clearInterval(nzState.hintIntervalId)
      nzState.hintIntervalId = null
    }
    
    // 状態をリセット
    nzState = {
      currentRiddle: null,
      currentRiddleIndex: -1,
      startTime: null,
      lastHintTime: null,
      listenerAnswers: new Map(),
      hintIntervalId: null,
    }
    
    // リスナーの回答をクリア
    commentQueueStore.getState().clearListenerAnswers()
  },
}

/**
 * ヒントを生成（不正解を抜粋して掛け合い）
 */
const generateHintDialogue = async (incorrectAnswers: { listenerName: string, answer: string }[]): Promise<string> => {
  // 不正解を抜粋（最大3件）
  const samples = incorrectAnswers.slice(0, 3)
  const sampleText = samples.map(a => `${a.listenerName}さん: ${a.answer}`).join('、')
  
  // 掛け合い形式でヒントを生成
  return `<A emotion="surprised">あれ？みんなの答え、見てみると面白いね！</A>
<B emotion="relaxed">そうですね。${sampleText}という回答もありましたね。</B>
<A emotion="happy">ヒント！答えは${nzState.currentRiddle?.answer.length || 0}文字だよ！</A>
<B emotion="relaxed">みなさん、もう一度考えてみてくださいね。</B>`
}

/**
 * ヒント機能のインターバルを開始
 */
const startHintInterval = () => {
  // 既存のインターバルをクリア
  if (nzState.hintIntervalId) {
    clearInterval(nzState.hintIntervalId)
  }
  
  const HINT_INTERVAL_MS = 2 * 60 * 1000 // 2分
  
  nzState.hintIntervalId = setInterval(async () => {
    const { projectState } = projectModeStore.getState()
    
    // 企画実行中でない場合は停止
    if (projectState !== 'projectRunning' || !nzState.currentRiddle) {
      if (nzState.hintIntervalId) {
        clearInterval(nzState.hintIntervalId)
        nzState.hintIntervalId = null
      }
      return
    }
    
    // 全ての回答を取得
    const allAnswers = commentQueueStore.getState().getAllListenerAnswers()
    
    // 正解/不正解を判定
    const incorrectAnswers: { listenerName: string, answer: string }[] = []
    
    for (const answer of allAnswers) {
      const normalizedAnswer = answer.message.trim().toLowerCase()
      const normalizedCorrect = nzState.currentRiddle.answer.toLowerCase()
      
      if (normalizedAnswer !== normalizedCorrect) {
        incorrectAnswers.push({
          listenerName: answer.userName,
          answer: answer.message,
        })
      }
    }
    
    // 不正解がある場合は、不正解を抜粋して掛け合い
    if (incorrectAnswers.length > 0) {
      console.log('[nzProject] ヒント: 不正解を抜粋して掛け合い')
      const hintScript = await generateHintDialogue(incorrectAnswers)
      await sendScript(hintScript)
      nzState.lastHintTime = Date.now()
    } else {
      // 不正解がない場合は、簡単なヒントを出す
      console.log('[nzProject] ヒント: 簡単なヒントを出す')
      const hintScript = `<A emotion="happy">ヒント！答えは${nzState.currentRiddle.answer.length}文字だよ！</A>
<B emotion="relaxed">みなさん、もう一度考えてみてくださいね。</B>`
      await sendScript(hintScript)
      nzState.lastHintTime = Date.now()
    }
  }, HINT_INTERVAL_MS)
  
  console.log('[nzProject] ヒントインターバルを開始しました（2分ごと）')
}

/**
 * なぞなぞ企画を登録
 */
export const registerNZProject = () => {
  projectManager.registerProject(nzProject)
  console.log('[nzProject] なぞなぞ企画を登録しました')
}

/**
 * ルピナスの承認判定（チャット欄からのメッセージを監視）
 * この関数は、handlers.tsから呼び出される必要があります
 */
export const checkLupinusApproval = async (message: string): Promise<boolean | null> => {
  const { projectState, activeProject } = projectModeStore.getState()
  
  // 提案待機中の場合のみ判定
  if (projectState !== 'proposalPending' || !activeProject || activeProject.id !== 'nz') {
    return null
  }
  
  if (isAffirmative(message)) {
    console.log('[nzProject] ルピナスが承認しました')
    await approveProject(nzProject)
    return true
  }
  
  if (isNegative(message)) {
    console.log('[nzProject] ルピナスが拒否しました')
    await rejectProject(nzProject)
    return false
  }
  
  return null
}

