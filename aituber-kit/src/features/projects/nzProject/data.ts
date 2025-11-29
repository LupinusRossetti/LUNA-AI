/**
 * なぞなぞ問題のデータ
 */

export interface Riddle {
  question: string
  answer: string
  category?: string // ジャンル（例: "食べ物", "動物", "ゲーム"など）
  difficulty?: 'easy' | 'medium' | 'hard' // 難易度
  explanation?: string // 解説
}

/**
 * なぞなぞ問題のリスト
 * 語感が合うなぞなぞ（問題と答えで同じ言葉が被っている）
 */
export const RIDDLES: Riddle[] = [
  // ユーザー提供のなぞなぞ（語感重視）
  { question: '駅は駅でも、おしりにある赤い駅ってなんだ？', answer: '血液', category: '体', difficulty: 'easy', explanation: '「おしり」の別の言い方である「けつ」と「駅」を合わせて「けつえき」' },
  { question: 'サルの鳴き声のなかに座っちゃうお酒ってなんだ？', answer: 'ウイスキー', category: '食べ物', difficulty: 'medium', explanation: 'サルの鳴き声「ウキー！」のなかに「いす」が座る' },
  { question: '必ず「ら」を添えるお料理ってなんだ？', answer: '天ぷら', category: '食べ物', difficulty: 'easy', explanation: '「ら」を添える（添付する）→ てんぷら' },
  { question: '辛く悲しい人生を送るおばあさんが握りしめている植物ってなんだ？', answer: 'クローバー', category: '自然', difficulty: 'hard', explanation: '辛く悲しい人生を送る「苦労婆（くろうば）」' },
  { question: 'アルファベットのなかで、伸ばすと頑張るあなたを応援してくれるのはどれ？', answer: 'L（エル）', category: 'その他', difficulty: 'hard', explanation: '真ん中に伸ばし棒を入れると「エール」になる' },
  { question: '牛がいて、塔があって、鹿がいる。それぞれが混ざり合っている職業ってなんだ？', answer: '投資家', category: 'その他', difficulty: 'hard', explanation: '「牛（うし）」「塔（とう）」「鹿（しか）」を混ぜて「とうしか」' },
  { question: 'トップの点を取ると辞めさせられる学校ってどこ？', answer: '大学', category: '学校', difficulty: 'medium', explanation: '「大学（だいがく）」のトップ（頭文字の点）を取ると「たいがく（退学）」' },
  { question: '借金をしているトンボが演奏している楽器ってなんだ？', answer: 'トロンボーン', category: '音楽', difficulty: 'hard', explanation: '借金（ローン）をトンボに混ぜる' },
  
  // 追加のなぞなぞ（語感重視）
  { question: 'パンはパンでも、食べられないパンは？', answer: 'フライパン', category: '食べ物', difficulty: 'easy', explanation: '定番中の定番です' },
  { question: 'おじいちゃんとするボール遊びってなーんだ？', answer: 'ソフトボール', category: 'スポーツ', difficulty: 'medium', explanation: '「祖父（そふ）」とボール' },
  { question: '冷蔵庫の中に隠れている動物は？', answer: 'ゾウ', category: '動物', difficulty: 'easy', explanation: '冷ゾウ庫' },
  { question: 'イスはイスでも、とっても冷たいイスは？', answer: 'アイス', category: '食べ物', difficulty: 'easy', explanation: 'ア「イス」' },
  { question: '食べると安心するケーキってなーんだ？', answer: 'ホットケーキ', category: '食べ物', difficulty: 'medium', explanation: '食べると「ホッ」とするから' },
  { question: '上は洪水、下は大火事、これなーんだ？', answer: 'お風呂', category: '家', difficulty: 'medium', explanation: '昔のお風呂は下で薪を燃やし、上にお湯があったため。今でも使われる有名ななぞなぞです' },
  { question: '逆立ちすると軽くなる動物は？', answer: 'イルカ', category: '動物', difficulty: 'hard', explanation: '「イルカ」を逆から読むと「軽い」' },
  { question: 'どんなに走っても、全然進まない車ってなに？', answer: '風車', category: 'その他', difficulty: 'medium', explanation: 'その場から動かないから（駐車も可）' },
  { question: 'カメとラクダとサイが買い物をしています。何を買った？', answer: 'カメラ', category: 'その他', difficulty: 'easy', explanation: 'カメ・ラクダ・サイ → カメラください' },
  { question: '入口はひとつなのに、出口がふたつある穴ってなーんだ？', answer: 'ズボン', category: 'その他', difficulty: 'easy', explanation: '足を通すところ（パンツも可）' },
  { question: '世界の真ん中にいる虫ってなーんだ？', answer: '蚊', category: '動物', difficulty: 'easy', explanation: '「せかい」の真ん中' },
  { question: 'トラックの運転手が、一方通行の道を逆走しましたが、警察に捕まりませんでした。なぜ？', answer: '歩いていたから', category: 'その他', difficulty: 'hard', explanation: 'トラックに乗っているとは言っていない' },
  { question: 'マラソンで2位の人を抜かしました。今何位？', answer: '2位', category: 'スポーツ', difficulty: 'medium', explanation: '2位の人を抜いたので、自分が2位になる' },
  { question: '9匹のトラが乗っている車は？', answer: 'トラック', category: '車', difficulty: 'easy', explanation: 'トラ・9' },
  { question: 'どんなに頼んでも売ってくれない本は？', answer: '見本', category: 'その他', difficulty: 'medium', explanation: '非売品だから' },
  { question: '消防署の好きな惑星は？', answer: '地球', category: '自然', difficulty: 'hard', explanation: '119番だから、いち・いち・きゅう' },
  { question: 'お父さんが嫌いな果物は？', answer: 'パパイヤ', category: '食べ物', difficulty: 'easy', explanation: 'パパ、嫌！' },
  
]

/**
 * カテゴリー別になぞなぞを取得
 */
export const getRiddlesByCategory = (category: string): Riddle[] => {
  return RIDDLES.filter(r => r.category === category)
}

/**
 * 難易度別になぞなぞを取得
 */
export const getRiddlesByDifficulty = (difficulty: 'easy' | 'medium' | 'hard'): Riddle[] => {
  return RIDDLES.filter(r => r.difficulty === difficulty)
}

/**
 * ランダムになぞなぞを取得
 */
export const getRandomRiddle = (): Riddle => {
  const index = Math.floor(Math.random() * RIDDLES.length)
  return RIDDLES[index]
}

/**
 * カテゴリーからランダムになぞなぞを取得
 */
export const getRandomRiddleByCategory = (category: string): Riddle | null => {
  const riddles = getRiddlesByCategory(category)
  if (riddles.length === 0) {
    return null
  }
  const index = Math.floor(Math.random() * riddles.length)
  return riddles[index]
}
