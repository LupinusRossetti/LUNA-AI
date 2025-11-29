/**
 * なぞなぞ自動生成機能（サーチグラウンディング使用）
 */

import { generateText } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { Riddle } from './data'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { messageSelectors } from '@/features/messages/messageSelectors'

/**
 * カテゴリーとキーワードのマッピング
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'ゲーム': ['ゲーム', 'ドラクエ', 'ポケモン', 'マリオ', 'RPG', 'アクション', 'パズル', 'プレイ', 'クリア', 'ステージ', 'ボス'],
  'アニメ': ['アニメ', 'アニメーション', 'アニメ見', 'アニメ観', 'アニメ見た', 'アニメ観た', 'アニメ好き', 'アニメファン'],
  '食べ物': ['食べ物', 'ラーメン', '寿司', 'パン', 'おにぎり', 'お茶', '料理', 'ご飯', '食事', '美味しい', '甘い', '辛い'],
  '動物': ['動物', '猫', '犬', '鳥', '魚', '虫', 'ペット', '飼う', '可愛い', 'ワンちゃん', 'ニャン'],
  '学校': ['学校', '勉強', 'テスト', '宿題', '授業', '先生', '生徒', 'クラス', '試験'],
  'スポーツ': ['スポーツ', '運動', 'サッカー', '野球', 'バスケ', 'テニス', '走る', '跳ぶ', '投げる'],
  '音楽': ['音楽', '歌', '楽器', 'ピアノ', 'ギター', 'ドラム', 'コンサート', 'ライブ', 'CD'],
}

/**
 * 会話履歴からジャンルを抽出（改善版）
 */
const extractCategoryFromChatHistory = (chatLog: any[]): string | null => {
  try {
    const recentMessages = chatLog.slice(-10) // 直近10件のメッセージ
    const textContent = recentMessages
      .map(msg => {
        if (typeof msg.content === 'string') {
          return msg.content
        }
        if (Array.isArray(msg.content)) {
          return msg.content
            .map((item: any) => (item.type === 'text' ? item.text : ''))
            .join(' ')
        }
        return ''
      })
      .join(' ')
      .toLowerCase()
    
    // 各カテゴリーのキーワードマッチ数をカウント
    const categoryScores: Record<string, number> = {}
    
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0
      for (const keyword of keywords) {
        if (textContent.includes(keyword.toLowerCase())) {
          score++
        }
      }
      if (score > 0) {
        categoryScores[category] = score
      }
    }
    
    // 最もスコアが高いカテゴリーを返す
    if (Object.keys(categoryScores).length > 0) {
      const bestCategory = Object.entries(categoryScores)
        .sort(([, a], [, b]) => b - a)[0][0]
      console.log('[riddleGenerator] カテゴリー抽出:', { bestCategory, scores: categoryScores })
      return bestCategory
    }
    
    return null
  } catch (error) {
    console.error('[riddleGenerator] カテゴリー抽出エラー:', error)
    return null
  }
}

/**
 * サーチグラウンディングを使ってなぞなぞを生成
 */
/**
 * サーチグラウンディングを使ってなぞなぞを生成
 */
export const generateRiddleWithSearchGrounding = async (category?: string): Promise<Riddle | null> => {
  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 1000
  
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const ss = settingsStore.getState()
      const hs = homeStore.getState()
      const chatLog = messageSelectors.getTextAndImageMessages(hs.chatLog)
      
      // カテゴリーが指定されていない場合、会話履歴から抽出
      if (!category) {
        category = extractCategoryFromChatHistory(chatLog) || undefined
      }
      
      const apiKey = ss.googleKey || process.env.GOOGLE_API_KEY
      if (!apiKey) {
        console.warn('[riddleGenerator] APIキーが設定されていません')
        return null
      }
      
      const aiInstance = createGoogleGenerativeAI({ apiKey })
      const model = 'gemini-2.0-flash-exp' // サーチグラウンディング対応モデル
      
      // プロンプトを作成（語感が合うなぞなぞを強調）
      let prompt = '語感が合うなぞなぞ（問題と答えで同じ言葉が被っている）を1つ出題してください。\n'
      prompt += '形式: 「問題: ... 答え: ...」\n'
      prompt += '例: 問題: パンはパンでも食べられないパンはなーんだ？ 答え: フライパン'
      
      if (category) {
        prompt = `${category}に関する${prompt}`
      }
      
      console.log('[riddleGenerator] なぞなぞ生成開始:', { category, attempt: attempt + 1, prompt })
      
      const response = await generateText({
        model: aiInstance(model, { useSearchGrounding: true }),
        messages: [
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        maxTokens: 500,
      })
      
      const text = response.text
      console.log('[riddleGenerator] 生成結果:', text)
      
      // 問題と答えを抽出（複数のパターンを試す）
      let question: string | null = null
      let answer: string | null = null
      
      // パターン1: 「問題: ... 答え: ...」形式
      const pattern1 = text.match(/問題[：:]\s*(.+?)(?:\n|答え|$)/i)
      const pattern2 = text.match(/答え[：:]\s*(.+?)(?:\n|$)/i)
      if (pattern1 && pattern2) {
        question = pattern1[1].trim()
        answer = pattern2[1].trim()
      }
      
      // パターン2: 「Q: ... A: ...」形式
      if (!question || !answer) {
        const qPattern = text.match(/Q[：:]\s*(.+?)(?:\n|A|$)/i)
        const aPattern = text.match(/A[：:]\s*(.+?)(?:\n|$)/i)
        if (qPattern && aPattern) {
          question = qPattern[1].trim()
          answer = aPattern[1].trim()
        }
      }
      
      // パターン3: 行ベースの抽出
      if (!question || !answer) {
        const lines = text.split('\n').filter(line => line.trim())
        if (lines.length >= 2) {
          // 最初の行が問題、2行目以降が答えの可能性
          question = lines[0].trim()
          answer = lines.slice(1).join(' ').trim()
        }
      }
      
      if (question && answer && question.length > 0 && answer.length > 0) {
        return {
          question,
          answer,
          category: category || 'その他',
          difficulty: 'medium',
        }
      }
      
      console.warn(`[riddleGenerator] なぞなぞの抽出に失敗しました (試行 ${attempt + 1}/${MAX_RETRIES})`)
      
      // リトライ前に待機
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    } catch (error: any) {
      console.error(`[riddleGenerator] なぞなぞ生成エラー (試行 ${attempt + 1}/${MAX_RETRIES}):`, error)
      
      // APIクォータ超過などの致命的なエラーの場合はリトライしない
      if (error?.message?.includes('quota') || error?.message?.includes('429')) {
        console.error('[riddleGenerator] APIクォータ超過のため、なぞなぞ生成を中止します')
        return null
      }
      
      // リトライ前に待機
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
      }
    }
  }
  
  console.error('[riddleGenerator] なぞなぞ生成に失敗しました（最大リトライ回数に達しました）')
  return null
}

