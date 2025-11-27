/**
 * 記憶管理システム
 * 会話から重要な情報を抽出して保存し、関連記憶を検索する
 * ファイルベースの保存システム
 */

import { Memory, MemoryType, MemoryStorage } from './memoryTypes'
import { generateMessageId } from '@/utils/messageUtils'

const MEMORY_API_BASE = '/api/memory'

/**
 * 記憶を保存する（ファイルベース）
 */
export async function saveMemory(memory: Omit<Memory, 'id' | 'timestamp' | 'canDelete'>): Promise<Memory> {
  const memories = await loadMemories()
  
  const newMemory: Memory = {
    id: generateMessageId(),
    timestamp: new Date().toISOString(),
    canDelete: true, // デフォルトで削除可能
    ...memory,
  }
  
  memories.push(newMemory)
  
  // API経由でファイルに保存
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch(`${MEMORY_API_BASE}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memories }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to save memories')
      }
    } catch (error) {
      console.error('[memoryManager] 記憶の保存に失敗:', error)
    }
  }
  
  console.log('[memoryManager] ✅ 記憶を保存しました:', {
    id: newMemory.id,
    type: newMemory.type,
    source: newMemory.source,
    content: newMemory.content.substring(0, 50),
    relatedName: newMemory.relatedName,
    keywords: newMemory.keywords,
    timestamp: newMemory.timestamp,
    totalMemories: memories.length
  })
  
  return newMemory
}

/**
 * 全ての記憶を読み込む（ファイルベース）
 */
export async function loadMemories(): Promise<Memory[]> {
  if (typeof window === 'undefined') {
    return []
  }
  
  try {
    const response = await fetch(`${MEMORY_API_BASE}/load`)
    if (!response.ok) {
      throw new Error('Failed to load memories')
    }
    
    const data: MemoryStorage = await response.json()
    return data.memories || []
  } catch (error) {
    console.error('[memoryManager] 記憶の読み込みに失敗:', error)
    return []
  }
}

/**
 * 関連する記憶を検索する（キーワードマッチング）
 */
export async function searchRelevantMemories(
  query: string,
  limit: number = 5
): Promise<Memory[]> {
  const memories = await loadMemories()
  
  if (memories.length === 0) {
    return []
  }
  
  // クエリを小文字に変換してキーワードを抽出
  const queryLower = query.toLowerCase()
  const queryKeywords = extractKeywords(queryLower)
  
  // 各記憶に関連度スコアを計算
  const scoredMemories = memories.map(memory => {
    let score = 0
    
    // キーワードマッチング
    for (const keyword of memory.keywords) {
      if (queryLower.includes(keyword.toLowerCase())) {
        score += 2
      }
    }
    
    // 内容の部分一致
    if (memory.content.toLowerCase().includes(queryLower)) {
      score += 1
    }
    
    // クエリのキーワードが記憶のキーワードに含まれている
    for (const qKeyword of queryKeywords) {
      if (memory.keywords.some(k => k.toLowerCase().includes(qKeyword))) {
        score += 1
      }
    }
    
    return { ...memory, relevanceScore: score }
  })
  
  // スコアが高い順にソート
  scoredMemories.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
  
  // スコアが0より大きいもののみを返す
  const relevantMemories = scoredMemories
    .filter(m => (m.relevanceScore || 0) > 0)
    .slice(0, limit)
  
  console.log('[memoryManager] 🔍 関連記憶を検索:', {
    query: query.substring(0, 50),
    totalMemories: memories.length,
    found: relevantMemories.length,
    memories: relevantMemories.map(m => ({
      id: m.id,
      type: m.type,
      content: m.content.substring(0, 50),
      keywords: m.keywords,
      score: m.relevanceScore,
      timestamp: m.timestamp
    }))
  })
  
  return relevantMemories
}

/**
 * テキストからキーワードを抽出する（簡易版）
 */
function extractKeywords(text: string): string[] {
  // 日本語の固有名詞や重要な単語を抽出（簡易版）
  // 実際の実装では、より高度な自然言語処理が必要
  const keywords: string[] = []
  
  // カタカナ語を抽出
  const katakanaMatches = text.match(/[ァ-ヶー]+/g)
  if (katakanaMatches) {
    keywords.push(...katakanaMatches.filter(k => k.length >= 2))
  }
  
  // 漢字を含む単語を抽出（簡易版）
  const kanjiMatches = text.match(/[一-龯]+/g)
  if (kanjiMatches) {
    keywords.push(...kanjiMatches.filter(k => k.length >= 2))
  }
  
  return keywords
}

/**
 * 記憶を削除する（ファイルベース）
 */
export async function deleteMemory(memoryId: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }
  
  try {
    const response = await fetch(`${MEMORY_API_BASE}/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ memoryId }),
    })
    
    if (!response.ok) {
      throw new Error('Failed to delete memory')
    }
    
    const result = await response.json()
    return result.deleted === true
  } catch (error) {
    console.error('[memoryManager] 記憶の削除に失敗:', error)
    return false
  }
}

/**
 * 全ての記憶をクリアする（ファイルベース）
 */
export async function clearMemories(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false
  }
  
  try {
    // 空の配列を保存することでクリア
    const response = await fetch(`${MEMORY_API_BASE}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ memories: [] }),
    })
    
    return response.ok
  } catch (error) {
    console.error('[memoryManager] 記憶のクリアに失敗:', error)
    return false
  }
}

