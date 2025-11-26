import { useState } from 'react'
import { TextButton } from '../textButton'
import settingsStore from '@/features/stores/settings'

type SaveButtonProps = {
  settingsToSave: Record<string, any>
  onSaveSuccess?: () => void
  onSaveError?: (error: string) => void
}

export const SaveButton = ({ settingsToSave, onSaveSuccess, onSaveError }: SaveButtonProps) => {
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/save-env', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: settingsToSave }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save settings')
      }

      onSaveSuccess?.()
      alert('設定を.envファイルに保存しました')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error saving settings:', error)
      onSaveError?.(errorMessage)
      alert(`設定の保存に失敗しました: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex justify-end mb-4">
      <TextButton onClick={handleSave} disabled={isSaving}>
        {isSaving ? '保存中...' : '保存'}
      </TextButton>
    </div>
  )
}


