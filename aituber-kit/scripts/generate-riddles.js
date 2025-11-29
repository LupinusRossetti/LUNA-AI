/**
 * サーチグラウンディングを使ってなぞなぞを100問生成するスクリプト
 */

const { generateText } = require('ai')
const { createGoogleGenerativeAI } = require('@ai-sdk/google')
require('dotenv').config()

const apiKey = process.env.GOOGLE_API_KEY
if (!apiKey) {
  console.error('GOOGLE_API_KEYが設定されていません')
  process.exit(1)
}

const aiInstance = createGoogleGenerativeAI({ apiKey })
const model = 'gemini-2.0-flash-exp'

/**
 * なぞなぞを生成
 */
async function generateRiddles(count = 100) {
  console.log(`なぞなぞを${count}問生成します...`)
  
  const prompt = `以下の形式のなぞなぞを${count}問生成してください。

形式の例：
- パンはパンでも食べられないパンはなーんだ？→フライパン
- おにぎりなのに食べられないおにぎりはなーんだ？→ナイト
- いつも謝っている果物なーんだ？→梨（ありがとう）

重要なポイント：
1. 問題と答えで同じ言葉が被っている（語感が合う）
2. 問題の語感と答えの語感が似ている
3. 答えが問題の一部を含んでいる
4. 面白くて分かりやすい
5. 日本語の語感を活かしたなぞなぞ

出力形式：
問題: [問題文]
答え: [答え]
カテゴリー: [カテゴリー（食べ物、動物、ゲーム、学校、家、自然、スポーツ、音楽など）]
難易度: [easy/medium/hard]

各なぞなぞを1行ずつ、以下のJSON形式で出力してください：
{"question": "問題文", "answer": "答え", "category": "カテゴリー", "difficulty": "難易度"}

100問すべてを出力してください。`

  try {
    const response = await generateText({
      model: aiInstance(model, { useSearchGrounding: true }),
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: 0.8,
      maxTokens: 8000,
    })
    
    const text = response.text
    console.log('生成されたテキスト:', text.substring(0, 500))
    
    // JSON形式の行を抽出
    const jsonLines = text.split('\n').filter(line => {
      const trimmed = line.trim()
      return trimmed.startsWith('{') && trimmed.includes('"question"')
    })
    
    const riddles = []
    for (const line of jsonLines) {
      try {
        const riddle = JSON.parse(line.trim())
        if (riddle.question && riddle.answer) {
          riddles.push({
            question: riddle.question,
            answer: riddle.answer,
            category: riddle.category || 'その他',
            difficulty: riddle.difficulty || 'medium',
          })
        }
      } catch (e) {
        // JSONパースエラーは無視
        console.warn('JSONパースエラー:', line.substring(0, 50))
      }
    }
    
    // テキストから直接抽出を試みる
    if (riddles.length < count) {
      const questionPattern = /問題[：:]\s*(.+?)(?:\n|答え|$)/gi
      const answerPattern = /答え[：:]\s*(.+?)(?:\n|問題|$)/gi
      
      const questions = []
      const answers = []
      let match
      
      while ((match = questionPattern.exec(text)) !== null) {
        questions.push(match[1].trim())
      }
      
      while ((match = answerPattern.exec(text)) !== null) {
        answers.push(match[1].trim())
      }
      
      for (let i = 0; i < Math.min(questions.length, answers.length); i++) {
        if (questions[i] && answers[i] && !riddles.find(r => r.question === questions[i])) {
          riddles.push({
            question: questions[i],
            answer: answers[i],
            category: 'その他',
            difficulty: 'medium',
          })
        }
      }
    }
    
    console.log(`\n生成されたなぞなぞ: ${riddles.length}問`)
    
    if (riddles.length < count) {
      console.warn(`警告: ${count}問生成できませんでした（${riddles.length}問のみ）`)
    }
    
    return riddles
  } catch (error) {
    console.error('なぞなぞ生成エラー:', error)
    throw error
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    const riddles = await generateRiddles(100)
    
    // TypeScript形式で出力
    console.log('\n=== 生成されたなぞなぞ（TypeScript形式） ===\n')
    console.log('export const RIDDLES: Riddle[] = [')
    
    riddles.forEach((riddle, index) => {
      const question = riddle.question.replace(/'/g, "\\'")
      const answer = riddle.answer.replace(/'/g, "\\'")
      const category = riddle.category || 'その他'
      const difficulty = riddle.difficulty || 'medium'
      
      console.log(`  { question: '${question}', answer: '${answer}', category: '${category}', difficulty: '${difficulty}' },`)
    })
    
    console.log(']')
    
    // JSON形式でも出力（確認用）
    console.log('\n=== 生成されたなぞなぞ（JSON形式） ===\n')
    console.log(JSON.stringify(riddles, null, 2))
    
  } catch (error) {
    console.error('エラー:', error)
    process.exit(1)
  }
}

main()

