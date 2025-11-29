import { create } from 'zustand'

/**
 * アプリケーションモード
 */
export type AppMode = 'normal' | 'project'

/**
 * 企画の状態
 */
export type ProjectState = 
  | 'idle'              // アイドル（通常モード）
  | 'proposalPending'   // 提案待機中（ルピナスの承認待ち）
  | 'projectIntro'     // 企画紹介中
  | 'projectRunning'    // 企画実行中
  | 'projectResult'    // 企画リザルト

/**
 * 企画の基本情報
 */
export interface Project {
  id: string // 企画ID（例: "nz"）
  name: string // 企画名（例: "なぞなぞ企画"）
  description?: string // 企画の説明
  prefix: string // 接頭辞（例: "#NZ", "/NZ"）
  data?: any // 企画固有のデータ
}

/**
 * 企画モードストアの状態
 */
interface ProjectModeState {
  // 状態
  currentMode: AppMode
  projectState: ProjectState
  activeProject: Project | null
  
  // アクション
  setMode: (mode: AppMode) => void
  setProjectState: (state: ProjectState) => void
  setActiveProject: (project: Project | null) => void
  resetProject: () => void
}

export const projectModeStore = create<ProjectModeState>((set) => ({
  // 初期状態
  currentMode: 'normal',
  projectState: 'idle',
  activeProject: null,

  // モードを設定
  setMode: (mode) => {
    set({ currentMode: mode })
    if (mode === 'normal') {
      set({ projectState: 'idle', activeProject: null })
    }
  },

  // 企画状態を設定
  setProjectState: (state) => {
    set({ projectState: state })
  },

  // アクティブな企画を設定
  setActiveProject: (project) => {
    set({ activeProject: project })
    if (project) {
      set({ currentMode: 'project' })
    } else {
      set({ currentMode: 'normal', projectState: 'idle' })
    }
  },

  // 企画をリセット
  resetProject: () => {
    set({
      currentMode: 'normal',
      projectState: 'idle',
      activeProject: null,
    })
  },
}))

