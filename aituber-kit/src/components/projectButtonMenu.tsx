/**
 * 企画ボタン用アコーディオンメニュー
 */

import { useState } from 'react'
import { projectManager } from '@/features/projects/projectBase'
import { approveProject } from '@/features/projects/projectBase'
import { projectModeStore } from '@/features/stores/projectModeStore'
import homeStore from '@/features/stores/home'
import { SpeakQueue } from '@/features/messages/speakQueue'

export const ProjectButtonMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const currentMode = projectModeStore((s) => s.currentMode)
  const projectState = projectModeStore((s) => s.projectState)
  const activeProject = projectModeStore((s) => s.activeProject)
  const allProjects = projectManager.getAllProjects()

  // 企画ボタンをクリックしたときの処理
  const handleProjectClick = async (projectId: string) => {
    console.log('[ProjectButtonMenu] 企画ボタンをクリック:', projectId)
    
    // 全てを中断（音声停止、処理停止）
    homeStore.setState({ 
      chatProcessing: false,
      isSpeaking: false,
    })
    SpeakQueue.stopAll()
    
    // 企画を取得
    const project = projectManager.getProject(projectId)
    if (!project) {
      console.error('[ProjectButtonMenu] 企画が見つかりません:', projectId)
      return
    }
    
    // 企画を承認して開始
    await approveProject(project)
    
    // メニューを閉じる
    setIsOpen(false)
  }

  // メニューが空の場合は表示しない
  if (allProjects.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-30">
      {/* メインボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-12 h-12 rounded-full bg-primary text-theme shadow-lg flex items-center justify-center hover:bg-primary-dark transition-colors"
        aria-label="企画メニュー"
        aria-expanded={isOpen}
        aria-controls="project-menu"
      >
        {isOpen ? (
          <span className="text-lg font-bold">×</span>
        ) : (
          <span className="text-lg font-bold">企</span>
        )}
      </button>

      {/* 企画メニュー */}
      {isOpen && (
        <div
          id="project-menu"
          className="absolute bottom-16 right-0 bg-white border border-gray-300 rounded-lg shadow-lg p-2 min-w-[200px] max-h-[400px] overflow-y-auto"
        >
          <div className="text-sm font-semibold mb-2 px-2 py-1 text-gray-700">
            企画
          </div>
          {allProjects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleProjectClick(project.id)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
              disabled={projectState === 'projectRunning' && activeProject?.id === project.id}
            >
              {project.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

