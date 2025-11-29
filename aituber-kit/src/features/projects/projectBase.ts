/**
 * 企画システムの基本実装
 */

import { ProjectBase, ProjectManager } from './projectTypes'
import { projectModeStore, ProjectState } from '@/features/stores/projectModeStore'
import { clearQueuesOnProjectStart, clearQueuesOnProjectIntro, clearQueuesOnProjectResult } from '@/features/youtube/commentQueue'

/**
 * 企画マネージャーの実装
 */
class ProjectManagerImpl implements ProjectManager {
  private projects: Map<string, ProjectBase> = new Map()

  registerProject(project: ProjectBase): void {
    this.projects.set(project.id, project)
    console.log('[projectBase] 企画を登録:', project.id, project.name)
  }

  unregisterProject(projectId: string): void {
    this.projects.delete(projectId)
    console.log('[projectBase] 企画を登録解除:', projectId)
  }

  getProject(projectId: string): ProjectBase | undefined {
    return this.projects.get(projectId)
  }

  getAllProjects(): ProjectBase[] {
    return Array.from(this.projects.values())
  }

  findProjectByProposalPrefix(prefix: string): ProjectBase | undefined {
    const normalizedPrefix = prefix.toUpperCase()
    return Array.from(this.projects.values()).find(
      p => p.proposalPrefix.toUpperCase() === normalizedPrefix
    )
  }

  findProjectByCommandPrefix(prefix: string): ProjectBase | undefined {
    const normalizedPrefix = prefix.toUpperCase()
    return Array.from(this.projects.values()).find(
      p => p.commandPrefix.toUpperCase() === normalizedPrefix
    )
  }
}

// シングルトンインスタンス
export const projectManager = new ProjectManagerImpl()

/**
 * 企画を開始する（共通処理）
 */
export const startProject = async (project: ProjectBase): Promise<void> => {
  console.log('[projectBase] 企画を開始:', project.id, project.name)
  
  // キューをクリア
  clearQueuesOnProjectStart()
  
  // 企画状態を設定
  projectModeStore.getState().setActiveProject({
    id: project.id,
    name: project.name,
    description: project.description,
    prefix: project.proposalPrefix,
    data: project.data,
  })
  
  // 企画紹介中に移行
  projectModeStore.getState().setProjectState('projectIntro')
  
  // 企画紹介の固定セリフを実行
  if (project.onIntro) {
    await project.onIntro()
  }
  
  // 企画実行中に移行
  projectModeStore.getState().setProjectState('projectRunning')
  
  // 企画開始の処理
  if (project.onStart) {
    await project.onStart()
  }
}

/**
 * 企画を終了する（共通処理）
 */
export const endProject = async (project: ProjectBase): Promise<void> => {
  console.log('[projectBase] 企画を終了:', project.id, project.name)
  
  // 企画リザルトに移行
  projectModeStore.getState().setProjectState('projectResult')
  
  // キューをクリア
  clearQueuesOnProjectResult()
  
  // 企画リザルトの処理
  if (project.onResult) {
    await project.onResult()
  }
  
  // 企画終了の処理
  if (project.onEnd) {
    await project.onEnd()
  }
  
  // 通常モードに戻る
  projectModeStore.getState().resetProject()
}

/**
 * 企画提案を受信したときの処理（共通処理）
 */
export const handleProjectProposal = async (
  project: ProjectBase,
  listenerName: string,
  message: string
): Promise<void> => {
  console.log('[projectBase] 企画提案を受信:', project.id, listenerName, message)
  
  // 提案待機中に移行
  projectModeStore.getState().setProjectState('proposalPending')
  
  // 企画提案の処理
  if (project.onProposalReceived) {
    await project.onProposalReceived(listenerName, message)
  }
}

/**
 * 企画を承認する（共通処理）
 */
export const approveProject = async (project: ProjectBase): Promise<void> => {
  console.log('[projectBase] 企画を承認:', project.id, project.name)
  
  // 承認の処理
  if (project.onApproved) {
    await project.onApproved()
  }
  
  // 企画を開始
  await startProject(project)
}

/**
 * 企画を拒否する（共通処理）
 */
export const rejectProject = async (project: ProjectBase): Promise<void> => {
  console.log('[projectBase] 企画を拒否:', project.id, project.name)
  
  // 拒否の処理
  if (project.onRejected) {
    await project.onRejected()
  }
  
  // 通常モードに戻る
  projectModeStore.getState().resetProject()
}

/**
 * 企画コマンドを処理する（共通処理）
 */
export const handleProjectCommand = async (
  project: ProjectBase,
  listenerName: string,
  command: string,
  message: string
): Promise<void> => {
  console.log('[projectBase] 企画コマンドを受信:', project.id, listenerName, command, message)
  
  // 企画コマンドの処理
  if (project.onCommand) {
    await project.onCommand(listenerName, command, message)
  }
}

