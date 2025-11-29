import { Talk } from './messages'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'

// 定数
const IDLE_MOTION_INTERVAL_MS = 5000

// 感情とモーションの設定型
interface EmotionMotionConfig {
  expression?: string
  motion?: string
}

export class Live2DHandler {
  // 掛け合いモード対応: キャラクター別のアイドルモーションインターバル
  private static idleMotionIntervals: Map<'A' | 'B' | undefined, NodeJS.Timeout | null> = new Map()
  // AudioContextの再利用（メモリ最適化）
  private static audioContext: AudioContext | null = null
  
  private static getAudioContext(): AudioContext {
    if (!Live2DHandler.audioContext || Live2DHandler.audioContext.state === 'closed') {
      Live2DHandler.audioContext = new AudioContext()
    }
    return Live2DHandler.audioContext
  }

  // Live2DViewerを取得する共通処理
  private static getLive2DViewer(characterId?: 'A' | 'B'): any {
    const hs = homeStore.getState()
    const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
    
    if (isDialogueMode && characterId) {
      return characterId === 'A' ? hs.live2dViewerA : hs.live2dViewerB
    }
    // 単体モード: レガシーのlive2dViewerを使用
    return hs.live2dViewer
  }

  // 感情とモーションを取得する共通処理
  private static getEmotionMotion(talk: Talk): EmotionMotionConfig {
    const ss = settingsStore.getState()
    let expression: string | undefined
    let motion: string | undefined

    switch (talk.emotion) {
      case 'neutral':
        expression = ss.neutralEmotions[Math.floor(Math.random() * ss.neutralEmotions.length)]
        motion = ss.neutralMotionGroup
        break
      case 'happy':
        expression = ss.happyEmotions[Math.floor(Math.random() * ss.happyEmotions.length)]
        motion = ss.happyMotionGroup
        break
      case 'sad':
        expression = ss.sadEmotions[Math.floor(Math.random() * ss.sadEmotions.length)]
        motion = ss.sadMotionGroup
        break
      case 'angry':
        expression = ss.angryEmotions[Math.floor(Math.random() * ss.angryEmotions.length)]
        motion = ss.angryMotionGroup
        break
      case 'relaxed':
        expression = ss.relaxedEmotions[Math.floor(Math.random() * ss.relaxedEmotions.length)]
        motion = ss.relaxedMotionGroup
        break
      case 'surprised':
        expression = ss.surprisedEmotions[Math.floor(Math.random() * ss.surprisedEmotions.length)]
        motion = ss.surprisedMotionGroup
        break
    }

    return { expression, motion }
  }

  static async speak(
    audioBuffer: ArrayBuffer,
    talk: Talk,
    isNeedDecode: boolean = true
  ) {
    const live2dViewer = Live2DHandler.getLive2DViewer(talk.characterId)
    if (!live2dViewer) return

    const { expression, motion } = Live2DHandler.getEmotionMotion(talk)

    // AudioContextの再利用（メモリ最適化）
    const audioContext = Live2DHandler.getAudioContext()
    let decodedAudio: AudioBuffer

    if (isNeedDecode) {
      // 圧縮音声の場合
      decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0)) // sliceでコピーを作成
    } else {
      // PCM16形式の場合
      const pcmData = new Int16Array(audioBuffer)
      const floatData = new Float32Array(pcmData.length)
      for (let i = 0; i < pcmData.length; i++) {
        floatData[i] =
          pcmData[i] < 0 ? pcmData[i] / 32768.0 : pcmData[i] / 32767.0
      }
      decodedAudio = audioContext.createBuffer(1, floatData.length, 24000) // sampleRateは必要に応じて調整
      decodedAudio.getChannelData(0).set(floatData)
    }

    // デコードされた音声データをBlobに変換
    // OfflineAudioContextは毎回作成する必要がある（再利用不可）
    const offlineContext = new OfflineAudioContext(
      decodedAudio.numberOfChannels,
      decodedAudio.length,
      decodedAudio.sampleRate
    )
    const source = offlineContext.createBufferSource()
    source.buffer = decodedAudio
    source.connect(offlineContext.destination)
    source.start()

    const renderedBuffer = await offlineContext.startRendering()
    const audioBlob = await new Blob([this.audioBufferToWav(renderedBuffer)], {
      type: 'audio/wav',
    })
    const audioUrl = URL.createObjectURL(audioBlob)

    // Live2Dモデルの表情を設定
    if (expression) {
      live2dViewer.expression(expression)
    }
    if (motion) {
      // 話しているキャラクターのアイドルモーションを停止
      const characterId = talk.characterId
      Live2DHandler.stopIdleMotion(characterId)
      live2dViewer.motion(motion, undefined, 3)
    }

    // live2dViewer.speak の onFinish コールバックを利用して音声再生完了を検知
    // StopSpeaking で強制停止された場合 onFinish が呼び出されず Promise が未解決のまま
    // 次の再生がブロックされる問題を回避するため、タイムアウトでフォールバック解決を追加
    await new Promise<void>((resolve) => {
      let resolved = false

      const finish = () => {
        if (resolved) return
        resolved = true
        resolve()
        URL.revokeObjectURL(audioUrl)
      }

      // ライブラリ経由の終了通知
      live2dViewer.speak(audioUrl, {
        volume: 1.0,
        expression,
        resetExpression: true,
        onFinish: finish,
        onError: (e: any) => {
          console.error('speak error:', e)
          finish()
        },
      })

      // フォールバック: 音声の理論上の再生時間 + 1 秒で強制解決
      const fallbackTimeout = (decodedAudio.duration || 0) * 1000 + 1000
      setTimeout(finish, fallbackTimeout)
    })
  }

  static async stopSpeaking(characterId?: 'A' | 'B') {
    const live2dViewer = Live2DHandler.getLive2DViewer(characterId)
    if (live2dViewer) {
      live2dViewer.stopSpeaking()
    }
  }

  static async resetToIdle(characterId?: 'A' | 'B') {
    // キャラクター別のインターバルを停止
    Live2DHandler.stopIdleMotion(characterId)

    const live2dViewer = Live2DHandler.getLive2DViewer(characterId)
    if (!live2dViewer) return

    const ss = settingsStore.getState()
    // Live2Dモデル以外の場合は早期リターン
    if (ss.modelType !== 'live2d') return

    const idleMotion = ss.idleMotionGroup || 'Idle'
    live2dViewer.motion(idleMotion)
    const expression =
      ss.neutralEmotions[Math.floor(Math.random() * ss.neutralEmotions.length)]
    if (expression) {
      live2dViewer.expression(expression)
    }

    // アイドルモーション再生を開始（キャラクター別）
    Live2DHandler.startIdleMotion(idleMotion, characterId)
  }

  // アイドルモーションのインターバル開始（キャラクター別対応）
  private static startIdleMotion(idleMotion: string, characterId?: 'A' | 'B') {
    const ss = settingsStore.getState()
    if (ss.modelType !== 'live2d') return

    // 既存のインターバルがあれば停止
    this.stopIdleMotion(characterId)

    const intervalId = setInterval(() => {
      const currentSs = settingsStore.getState()
      if (currentSs.modelType !== 'live2d') {
        this.stopIdleMotion(characterId)
        return
      }

      const hs = homeStore.getState()
      const isDialogueMode = process.env.NEXT_PUBLIC_DIALOGUE_MODE === 'true'
      
      // 掛け合いモード: characterIdに応じてA/B別々のviewerを使用
      let viewer: any = null
      if (isDialogueMode && characterId) {
        viewer = characterId === 'A' ? hs.live2dViewerA : hs.live2dViewerB
      } else {
        viewer = hs.live2dViewer
      }

      // Viewerが存在しない、または破棄済みの場合はインターバルを停止
      if (!viewer || (viewer as any).destroyed) {
        this.stopIdleMotion(characterId)
        return
      }

      try {
        viewer.motion(idleMotion)
      } catch (error) {
        console.error('Idle motion failed:', error, { characterId })
        this.stopIdleMotion(characterId)
      }
    }, IDLE_MOTION_INTERVAL_MS)

    // インターバルIDを保存
    this.idleMotionIntervals.set(characterId, intervalId)
  }

  // アイドルモーションのインターバル停止（キャラクター別対応）
  private static stopIdleMotion(characterId?: 'A' | 'B') {
    const intervalId = this.idleMotionIntervals.get(characterId)
    if (intervalId) {
      clearInterval(intervalId)
      this.idleMotionIntervals.set(characterId, null)
    }
  }

  // WAVファイルフォーマットに変換するヘルパー関数
  private static audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
    const numOfChan = buffer.numberOfChannels
    const length = buffer.length * numOfChan * 2
    const buffer2 = new ArrayBuffer(44 + length)
    const view = new DataView(buffer2)
    const channels = []
    let sample
    let offset = 0
    let pos = 0

    // WAVヘッダーの作成
    setUint32(0x46464952) // "RIFF"
    setUint32(36 + length) // file length
    setUint32(0x45564157) // "WAVE"
    setUint32(0x20746d66) // "fmt "
    setUint32(16) // section length
    setUint16(1) // PCM
    setUint16(numOfChan)
    setUint32(buffer.sampleRate)
    setUint32(buffer.sampleRate * 2 * numOfChan) // byte rate
    setUint16(numOfChan * 2) // block align
    setUint16(16) // bits per sample
    setUint32(0x61746164) // "data"
    setUint32(length)

    // チャンネルデータの取得
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i))
    }

    // インターリーブ
    while (pos < buffer.length) {
      for (let i = 0; i < numOfChan; i++) {
        sample = Math.max(-1, Math.min(1, channels[i][pos]))
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0
        view.setInt16(44 + offset, sample, true)
        offset += 2
      }
      pos++
    }

    function setUint16(data: number) {
      view.setUint16(pos, data, true)
      pos += 2
    }

    function setUint32(data: number) {
      view.setUint32(pos, data, true)
      pos += 4
    }

    return buffer2
  }
}
