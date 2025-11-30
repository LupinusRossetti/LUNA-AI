/**
 * 企画システムの型定義
 */

import { Project, ProjectState } from '@/features/stores/projectModeStore'

/**
 * 企画の基本インターフェース
 */
export interface ProjectBase {
  id: string // 企画ID（例: "nz"）
  name: string // 企画名（例: "なぞなぞ企画"）
  description?: string // 企画の説明
  proposalPrefix: string // 提案接頭辞（例: "#NZ"）
  commandPrefix: string // コマンド接頭辞（例: "/NZ"）
  
  // 企画のライフサイクル
  onProposalReceived?: (listenerName: string, message: string) => Promise<void>
  onApproved?: () => Promise<void>
  onRejected?: () => Promise<void>
  onIntro?: () => Promise<void>
  onStart?: () => Promise<void>
  onCommand?: (listenerName: string, command: string, message: string) => Promise<void>
  onResult?: () => Promise<void>
  onEnd?: () => Promise<void>
  
  // 企画固有のデータ
  data?: any
}

/**
 * 企画マネージャーのインターフェース
 */
export interface ProjectManager {
  registerProject: (project: ProjectBase) => void
  unregisterProject: (projectId: string) => void
  getProject: (projectId: string) => ProjectBase | undefined
  getAllProjects: () => ProjectBase[]
  findProjectByProposalPrefix: (prefix: string) => ProjectBase | undefined
  findProjectByCommandPrefix: (prefix: string) => ProjectBase | undefined
}

/**
 * 企画の状態遷移イベント
 */
export type ProjectEvent = 
  | 'proposal-received'
  | 'approved'
  | 'rejected'
  | 'intro'
  | 'start'
  | 'command'
  | 'result'
  | 'end'


