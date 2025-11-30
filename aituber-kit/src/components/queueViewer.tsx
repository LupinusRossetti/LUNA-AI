import React, { useState } from 'react'
import { commentQueueStore, QueuedComment } from '@/features/stores/commentQueueStore'

interface QueueViewerProps {
  isOpen: boolean
  onClose: () => void
}

export const QueueViewer: React.FC<QueueViewerProps> = ({ isOpen, onClose }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const commentQueue = commentQueueStore((s) => s.commentQueue)
  const projectQueue = commentQueueStore((s) => s.projectQueue)

  if (!isOpen) return null

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = () => {
    const allIds = new Set<string>()
    commentQueue.forEach((c) => allIds.add(c.id))
    projectQueue.forEach((c) => allIds.add(c.id))
    setSelectedIds(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedIds(new Set())
  }

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return

    const { commentQueue: currentCommentQueue, projectQueue: currentProjectQueue } = commentQueueStore.getState()
    
    // 選択されたコメントを除外
    const newCommentQueue = currentCommentQueue.filter((c) => !selectedIds.has(c.id))
    const newProjectQueue = currentProjectQueue.filter((c) => !selectedIds.has(c.id))
    
    commentQueueStore.setState({
      commentQueue: newCommentQueue,
      projectQueue: newProjectQueue,
    })
    
    setSelectedIds(new Set())
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`
  }

  const renderComment = (comment: QueuedComment, queueType: 'comment' | 'project') => {
    const isSelected = selectedIds.has(comment.id)
    const priorityColor = comment.priority === 'high' ? 'bg-yellow-50' : 'bg-gray-50'
    
    return (
      <div
        key={comment.id}
        className={`p-3 border-b border-gray-200 cursor-pointer hover:bg-gray-100 ${priorityColor} ${isSelected ? 'bg-blue-100' : ''}`}
        onClick={() => handleToggleSelect(comment.id)}
      >
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleToggleSelect(comment.id)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-800">{comment.userName}</span>
              <span className="text-xs text-gray-500">{formatTime(comment.timestamp)}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${
                comment.priority === 'high' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'
              }`}>
                {comment.priority === 'high' ? '高' : '低'}
              </span>
              {comment.characterId && (
                <span className="text-xs px-2 py-0.5 rounded bg-blue-200 text-blue-800">
                  {comment.characterId === 'A' ? 'IR' : 'FI'}
                </span>
              )}
              {comment.prefixType === 'project-proposal' && (
                <span className="text-xs px-2 py-0.5 rounded bg-green-200 text-green-800">
                  {comment.prefix}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-700 break-words">{comment.comment}</div>
            {comment.message !== comment.comment && (
              <div className="text-xs text-gray-500 mt-1">メッセージ: {comment.message}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">キュー確認</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* 操作ボタン */}
        <div className="flex items-center gap-2 p-4 border-b border-gray-200 bg-gray-50">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            全て選択
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            選択解除
          </button>
          <button
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className={`px-3 py-1 text-sm rounded ${
              selectedIds.size === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            選択を削除 ({selectedIds.size})
          </button>
          <div className="ml-auto text-sm text-gray-600">
            通常キュー: {commentQueue.length}件 / 企画キュー: {projectQueue.length}件
          </div>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto">
          {commentQueue.length === 0 && projectQueue.length === 0 ? (
            <div className="p-8 text-center text-gray-500">キューにコメントがありません</div>
          ) : (
            <>
              {commentQueue.length > 0 && (
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">通常キュー ({commentQueue.length}件)</h3>
                  <div className="border border-gray-200 rounded">
                    {commentQueue.map((comment) => renderComment(comment, 'comment'))}
                  </div>
                </div>
              )}
              {projectQueue.length > 0 && (
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-2 text-gray-800">企画キュー ({projectQueue.length}件)</h3>
                  <div className="border border-gray-200 rounded">
                    {projectQueue.map((comment) => renderComment(comment, 'project'))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

