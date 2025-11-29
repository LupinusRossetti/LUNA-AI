import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import homeStore from '@/features/stores/home'
import menuStore from '@/features/stores/menu'
import settingsStore, { SettingsState } from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'
import { TextButton } from '../textButton'
import { SaveButton } from './SaveButton'

// Character型の定義
type Character = Pick<
  SettingsState,
  | 'characterName'
  | 'showAssistantText'
  | 'showCharacterName'
  | 'systemPrompt'
  | 'characterPreset1'
  | 'characterPreset2'
  | 'characterPreset3'
  | 'characterPreset4'
  | 'characterPreset5'
  | 'customPresetName1'
  | 'customPresetName2'
  | 'customPresetName3'
  | 'customPresetName4'
  | 'customPresetName5'
  | 'selectedPresetIndex'
  | 'selectedVrmPath'
  | 'selectedLive2DPath'
>

const emotionFields = [
  {
    key: 'neutralEmotions',
    label: 'Neutral Emotions',
    defaultValue: ['Neutral'],
  },
  {
    key: 'happyEmotions',
    label: 'Happy Emotions',
    defaultValue: ['Happy,Happy2'],
  },
  {
    key: 'sadEmotions',
    label: 'Sad Emotions',
    defaultValue: ['Sad,Sad2,Troubled'],
  },
  {
    key: 'angryEmotions',
    label: 'Angry Emotions',
    defaultValue: ['Angry,Focus'],
  },
  {
    key: 'relaxedEmotions',
    label: 'Relaxed Emotions',
    defaultValue: ['Relaxed'],
  },
  {
    key: 'surprisedEmotions',
    label: 'Surprised Emotions',
    defaultValue: ['Surprised'],
  },
] as const

const motionFields = [
  { key: 'idleMotionGroup', label: 'Idle Motion Group', defaultValue: 'Idle' },
  {
    key: 'neutralMotionGroup',
    label: 'Neutral Motion Group',
    defaultValue: 'Neutral',
  },
  {
    key: 'happyMotionGroup',
    label: 'Happy Motion Group',
    defaultValue: 'Happy',
  },
  { key: 'sadMotionGroup', label: 'Sad Motion Group', defaultValue: 'Sad' },
  {
    key: 'angryMotionGroup',
    label: 'Angry Motion Group',
    defaultValue: 'Angry',
  },
  {
    key: 'relaxedMotionGroup',
    label: 'Relaxed Motion Group',
    defaultValue: 'Relaxed',
  },
  {
    key: 'surprisedMotionGroup',
    label: 'Surprised Motion Group',
    defaultValue: 'Surprised',
  },
] as const

interface Live2DModel {
  path: string
  name: string
  expressions: string[]
  motions: string[]
}

type EmotionFieldKey = (typeof emotionFields)[number]['key']

const Live2DSettingsForm = () => {
  const store = settingsStore()
  const { t } = useTranslation()
  const [currentModel, setCurrentModel] = useState<Live2DModel | null>(null)
  const [openDropdown, setOpenDropdown] = useState<EmotionFieldKey | null>(null)

  useEffect(() => {
    // 現在選択されているLive2Dモデルの情報を取得
    const fetchCurrentModel = async () => {
      try {
        const response = await fetch('/api/get-live2d-list')
        const models: Live2DModel[] = await response.json()
        const selected = models.find(
          (model) => model.path === store.selectedLive2DPath
        )
        setCurrentModel(selected || null)
      } catch (error) {
        console.error('Error fetching Live2D model info:', error)
      }
    }

    if (store.selectedLive2DPath) {
      fetchCurrentModel()
    }
  }, [store.selectedLive2DPath])

  // コンポーネントマウント時にデフォルト値を設定
  useEffect(() => {
    const updates: Record<string, any> = {}

    emotionFields.forEach((field) => {
      if (!store[field.key] || store[field.key].length === 0) {
        updates[field.key] = field.defaultValue
      }
    })

    motionFields.forEach((field) => {
      if (!store[field.key] || store[field.key] === '') {
        updates[field.key] = field.defaultValue
      }
    })

    if (Object.keys(updates).length > 0) {
      settingsStore.setState(updates)
    }
  }, [])

  const handleEmotionChange = (
    key: EmotionFieldKey,
    expression: string,
    checked: boolean
  ) => {
    const currentValues = store[key]
    const newValues = checked
      ? [...currentValues, expression]
      : currentValues.filter((value) => value !== expression)

    settingsStore.setState({
      [key]: newValues,
    })
  }

  const handleMotionChange = (key: string, value: string) => {
    settingsStore.setState({
      [key]: value,
    })
  }

  if (!currentModel) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500">
        {t('Live2D.LoadingModel')}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="mb-6">
        <div className="mb-4 text-xl font-bold">{t('Live2D.Emotions')}</div>
        <div className="mb-6 whitespace-pre-line">
          {t('Live2D.EmotionInfo')}
        </div>
        <div className="space-y-4 text-sm">
          {emotionFields.map((field) => (
            <div key={field.key}>
              <label className="block mb-2 font-bold">
                {t(`Live2D.${field.key}`)}
              </label>
              <div className="relative">
                <button
                  type="button"
                  className="w-full px-2 py-2 bg-white hover:bg-white-hover rounded-lg text-left flex items-center justify-between"
                  onClick={() =>
                    setOpenDropdown(
                      openDropdown === field.key ? null : field.key
                    )
                  }
                >
                  <div className="flex flex-wrap gap-1">
                    {store[field.key].length > 0 ? (
                      store[field.key].map((expression) => (
                        <span
                          key={expression}
                          className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-lg mr-1"
                        >
                          {expression}
                          <button
                            type="button"
                            className="ml-4 text-gray-500 hover:text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEmotionChange(field.key, expression, false)
                            }}
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="">{t('Live2D.SelectEmotions')}</span>
                    )}
                  </div>
                  <svg
                    className={`h-4 w-4  transition-transform ${
                      openDropdown === field.key ? 'rotate-180' : ''
                    }`}
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2 5l6 6 6-6"
                    />
                  </svg>
                </button>
                {openDropdown === field.key && (
                  <div className="absolute z-10 w-full mt-4 max-h-[200px] overflow-y-auto bg-white rounded-lg shadow-lg border-gray-200 divide-y divide-gray-200">
                    {currentModel.expressions.map((expression) => (
                      <label
                        key={expression}
                        className="flex items-center px-4 py-2 hover:bg-white-hover cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mr-2"
                          checked={store[field.key].includes(expression)}
                          onChange={(e) =>
                            handleEmotionChange(
                              field.key,
                              expression,
                              e.target.checked
                            )
                          }
                        />
                        <span className="">{expression}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="">
        <div className="mb-4 text-xl font-bold">{t('Live2D.MotionGroups')}</div>
        <div className="mb-6 whitespace-pre-line">
          {t('Live2D.MotionGroupsInfo')}
        </div>
        <div className="space-y-4">
          {motionFields.map((field) => (
            <div key={field.key}>
              <label className="block mb-2 font-bold">
                {t(`Live2D.${field.key}`)}
              </label>
              <div className="relative">
                <select
                  className="w-full px-4 py-2 bg-white hover:bg-white-hover rounded-lg appearance-none cursor-pointer"
                  value={store[field.key]}
                  onChange={(e) =>
                    handleMotionChange(field.key, e.target.value)
                  }
                >
                  <option value="" className="">
                    {t('Live2D.SelectMotionGroup')}
                  </option>
                  {currentModel.motions.map((motion) => (
                    <option
                      key={motion}
                      value={motion}
                      className="py-4 px-8 hover:bg-primary hover:text-theme"
                    >
                      {motion}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <svg
                    className="h-4 w-4 "
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M2 5l6 6 6-6"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const Character = () => {
  const { t } = useTranslation()
  const {
    characterName,
    selectedVrmPath,
    selectedLive2DPath,
    selectedLive2DPathA,
    selectedLive2DPathB,
    modelType,
    fixedCharacterPosition,
    systemPrompt,
    characterPreset1,
    characterPreset2,
    characterPreset3,
    characterPreset4,
    characterPreset5,
    customPresetName1,
    customPresetName2,
    customPresetName3,
    customPresetName4,
    customPresetName5,
    selectedPresetIndex,
    lightingIntensity,
    characterAName,
    characterBName,
    systemPromptA,
    systemPromptB,
    characterPositionA,
    characterPositionB,
    live2dBounceEnabled,
    live2dBounceSpeed,
    live2dBounceAmount,
  } = settingsStore()
  const [vrmFiles, setVrmFiles] = useState<string[]>([])
  const [live2dModels, setLive2dModels] = useState<
    Array<{ path: string; name: string }>
  >([])
  
  // プロンプトファイルの内容を管理
  const [promptFileAContent, setPromptFileAContent] = useState('')
  const [promptFileBContent, setPromptFileBContent] = useState('')
  const [promptFileAPath, setPromptFileAPath] = useState(process.env.NEXT_PUBLIC_PROMPT_FILE_A || './prompts/iris.txt')
  const [promptFileBPath, setPromptFileBPath] = useState(process.env.NEXT_PUBLIC_PROMPT_FILE_B || './prompts/fiona.txt')
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false)

  const characterPresets = [
    {
      key: 'characterPreset1',
      value: characterPreset1,
    },
    {
      key: 'characterPreset2',
      value: characterPreset2,
    },
    {
      key: 'characterPreset3',
      value: characterPreset3,
    },
    {
      key: 'characterPreset4',
      value: characterPreset4,
    },
    {
      key: 'characterPreset5',
      value: characterPreset5,
    },
  ]

  const customPresetNames = [
    customPresetName1,
    customPresetName2,
    customPresetName3,
    customPresetName4,
    customPresetName5,
  ]

  useEffect(() => {
    fetch('/api/get-vrm-list')
      .then((res) => res.json())
      .then((files) => setVrmFiles(files))
      .catch((error) => {
        console.error('Error fetching VRM list:', error)
      })

    fetch('/api/get-live2d-list')
      .then((res) => res.json())
      .then((models) => setLive2dModels(models))
      .catch((error) => {
        console.error('Error fetching Live2D list:', error)
      })

    // プロンプトファイルを読み込む
    setIsLoadingPrompt(true)
    Promise.all([
      fetch(`/api/load-prompt?filePath=${encodeURIComponent(promptFileAPath)}`)
        .then((res) => res.json())
        .then((data) => setPromptFileAContent(data.content || ''))
        .catch((error) => {
          console.error('Error loading prompt file A:', error)
          setPromptFileAContent('')
        }),
      fetch(`/api/load-prompt?filePath=${encodeURIComponent(promptFileBPath)}`)
        .then((res) => res.json())
        .then((data) => setPromptFileBContent(data.content || ''))
        .catch((error) => {
          console.error('Error loading prompt file B:', error)
          setPromptFileBContent('')
        }),
    ]).finally(() => setIsLoadingPrompt(false))
  }, [])
  
  const handlePositionAction = (action: 'fix' | 'unfix' | 'reset') => {
    try {
      const { viewer, live2dViewer } = homeStore.getState()

      if (modelType === 'vrm') {
        const methodMap = {
          fix: 'fixCameraPosition',
          unfix: 'unfixCameraPosition',
          reset: 'resetCameraPosition',
        }
        const method = methodMap[action]
        if (viewer && typeof (viewer as any)[method] === 'function') {
          ;(viewer as any)[method]()
        } else {
          throw new Error(`VRM viewer method ${method} not available`)
        }
      } else if (live2dViewer) {
        const methodMap = {
          fix: 'fixPosition',
          unfix: 'unfixPosition',
          reset: 'resetPosition',
        }
        const method = methodMap[action]
        if (typeof (live2dViewer as any)[method] === 'function') {
          ;(live2dViewer as any)[method]()
        } else {
          throw new Error(`Live2D viewer method ${method} not available`)
        }
      }

      const messageMap = {
        fix: t('Toasts.PositionFixed'),
        unfix: t('Toasts.PositionUnfixed'),
        reset: t('Toasts.PositionReset'),
      }

      toastStore.getState().addToast({
        message: messageMap[action],
        type: action === 'fix' ? 'success' : 'info',
        tag: `position-${action}`,
      })
    } catch (error) {
      console.error(`Position ${action} failed:`, error)
      toastStore.getState().addToast({
        message: t('Toasts.PositionActionFailed'),
        type: 'error',
        tag: 'position-error',
      })
    }
  }

  const handleVrmUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)

    const response = await fetch('/api/upload-vrm-list', {
      method: 'POST',
      body: formData,
    })

    if (response.ok) {
      const { path } = await response.json()
      settingsStore.setState({ selectedVrmPath: path })
      const { viewer } = homeStore.getState()
      viewer.loadVrm(path)

      // リストを更新
      fetch('/api/get-vrm-list')
        .then((res) => res.json())
        .then((files) => setVrmFiles(files))
        .catch((error) => {
          console.error('Error fetching VRM list:', error)
        })
    }
  }

  // プロンプトファイルを保存する関数
  const handleSavePromptFile = async (characterId: 'A' | 'B') => {
    const filePath = characterId === 'A' ? promptFileAPath : promptFileBPath
    const content = characterId === 'A' ? promptFileAContent : promptFileBContent
    
    try {
      const response = await fetch('/api/save-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath, content }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to save prompt file')
      }

      toastStore.getState().addToast({
        message: `${characterId === 'A' ? characterAName : characterBName}のプロンプトファイルを保存しました`,
        type: 'success',
        tag: `prompt-save-${characterId}`,
      })
    } catch (error) {
      console.error('Error saving prompt file:', error)
      toastStore.getState().addToast({
        message: `プロンプトファイルの保存に失敗しました: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'error',
        tag: `prompt-save-error-${characterId}`,
      })
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Image
            src="/images/setting-icons/character-settings.svg"
            alt="Character Settings"
            width={24}
            height={24}
            className="mr-2"
          />
          <h2 className="text-2xl font-bold">{t('CharacterSettings')}</h2>
        </div>
        <SaveButton settingsToSave={{
          NEXT_PUBLIC_CHARACTER_A_NAME: characterAName,
          NEXT_PUBLIC_CHARACTER_B_NAME: characterBName,
                  NEXT_PUBLIC_SELECTED_LIVE2D_PATH_A: selectedLive2DPathA,
                  NEXT_PUBLIC_SELECTED_LIVE2D_PATH_B: selectedLive2DPathB,
                  NEXT_PUBLIC_SELECTED_VRM_PATH: selectedVrmPath,
                  NEXT_PUBLIC_MODEL_TYPE: modelType,
                  NEXT_PUBLIC_LIVE2D_BOUNCE_ENABLED: live2dBounceEnabled ? 'true' : 'false',
                  NEXT_PUBLIC_LIVE2D_BOUNCE_SPEED: live2dBounceSpeed.toString(),
                  NEXT_PUBLIC_LIVE2D_BOUNCE_AMOUNT: live2dBounceAmount.toString(),
        }} />
      </div>
      <div className="">
        <div className="mb-4 text-xl font-bold">{t('CharacterName')}</div>
        <div className="space-y-2">
          <div>
            <label className="block text-sm font-medium mb-1">キャラクターA</label>
            <input
              className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg"
              type="text"
              placeholder="キャラクターAの名前"
              value={characterAName}
              onChange={(e) =>
                settingsStore.setState({ characterAName: e.target.value })
              }
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">キャラクターB</label>
            <input
              className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg"
              type="text"
              placeholder="キャラクターBの名前"
              value={characterBName}
              onChange={(e) =>
                settingsStore.setState({ characterBName: e.target.value })
              }
            />
          </div>
        </div>

        <div className="mt-6 mb-4 text-xl font-bold">
          {t('CharacterModelLabel')}
        </div>
        <div className="mb-4">{t('CharacterModelInfo')}</div>

        <div className="flex mb-2">
          <button
            className={`px-4 py-2 rounded-lg mr-2 ${
              modelType === 'vrm'
                ? 'bg-primary text-theme'
                : 'bg-white hover:bg-white-hover'
            }`}
            onClick={() => settingsStore.setState({ modelType: 'vrm' })}
          >
            VRM
          </button>
          <button
            className={`px-4 py-2 rounded-lg ${
              modelType === 'live2d'
                ? 'bg-primary text-theme'
                : 'bg-white hover:bg-white-hover'
            }`}
            onClick={() => settingsStore.setState({ modelType: 'live2d' })}
          >
            Live2D
          </button>
        </div>

        {modelType === 'vrm' ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">キャラクターAのVRMモデル</label>
                <select
                  className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg"
                  value={selectedVrmPath}
                  onChange={(e) => {
                    const path = e.target.value
                    settingsStore.setState({ selectedVrmPath: path })
                    const { viewer } = homeStore.getState()
                    viewer.loadVrm(path)
                  }}
                >
                  {vrmFiles.length === 0 ? (
                    <option value="">読み込み中...</option>
                  ) : (
                    vrmFiles.map((file) => (
                      <option key={file} value={`/vrm/${file}`}>
                        {file.replace('.vrm', '')}
                      </option>
                    ))
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">キャラクターBのVRMモデル</label>
                <select
                  className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg"
                  value={selectedVrmPath}
                  onChange={(e) => {
                    const path = e.target.value
                    settingsStore.setState({ selectedVrmPath: path })
                    const { viewer } = homeStore.getState()
                    viewer.loadVrm(path)
                  }}
                >
                  {vrmFiles.length === 0 ? (
                    <option value="">読み込み中...</option>
                  ) : (
                    vrmFiles.map((file) => (
                      <option key={file} value={`/vrm/${file}`}>
                        {file.replace('.vrm', '')}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="my-4">
              <TextButton
                onClick={() => {
                  const { fileInput } = menuStore.getState()
                  if (fileInput) {
                    fileInput.accept = '.vrm'
                    fileInput.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        handleVrmUpload(file)
                      }
                    }
                    fileInput.click()
                  }
                }}
              >
                {t('OpenVRM')}
              </TextButton>
            </div>
          </>
        ) : (
          <>
            <div className="my-4 whitespace-pre-line">
              {t('Live2D.FileInfo')}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">キャラクターAのLive2Dモデル</label>
                <select
                  className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg mb-2"
                  value={selectedLive2DPathA}
                  onChange={(e) => {
                    const path = e.target.value
                    settingsStore.setState({ selectedLive2DPathA: path })
                  }}
                >
                  {live2dModels.length === 0 ? (
                    <option value="">読み込み中...</option>
                  ) : (
                    live2dModels.map((model) => (
                      <option key={model.path} value={model.path}>
                        {model.name}
                      </option>
                    ))
                  )}
                </select>
                {selectedLive2DPathA && (
                  <div className="mt-2 text-sm text-gray-500">
                    選択中: {live2dModels.find(m => m.path === selectedLive2DPathA)?.name || selectedLive2DPathA}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">キャラクターBのLive2Dモデル</label>
                <select
                  className="text-ellipsis px-4 py-2 w-full bg-white hover:bg-white-hover rounded-lg mb-2"
                  value={selectedLive2DPathB}
                  onChange={(e) => {
                    const path = e.target.value
                    settingsStore.setState({ selectedLive2DPathB: path })
                  }}
                >
                  {live2dModels.length === 0 ? (
                    <option value="">読み込み中...</option>
                  ) : (
                    live2dModels.map((model) => (
                      <option key={model.path} value={model.path}>
                        {model.name}
                      </option>
                    ))
                  )}
                </select>
                {selectedLive2DPathB && (
                  <div className="mt-2 text-sm text-gray-500">
                    選択中: {live2dModels.find(m => m.path === selectedLive2DPathB)?.name || selectedLive2DPathB}
                  </div>
                )}
              </div>
            </div>
            <div className="my-4">
              <Live2DSettingsForm />
            </div>
          </>
        )}

        {/* Character Position Controls - A/B分離 */}
        <div className="my-6 space-y-6">
          <div>
            <div className="text-xl font-bold mb-4">キャラクターAの位置設定</div>
            <div className="mb-4">{t('CharacterPositionInfo')}</div>
            <div className="mb-2 text-sm font-medium">
              {t('CurrentStatus')}:{' '}
              <span className="font-bold">
                {fixedCharacterPosition
                  ? t('PositionFixed')
                  : t('PositionNotFixed')}
              </span>
            </div>
            <div className="mb-4 text-sm">
              現在の位置: X={characterPositionA.x.toFixed(0)}, Y={characterPositionA.y.toFixed(0)}, スケール={characterPositionA.scale.toFixed(2)}
            </div>
            <div className="flex gap-4 md:flex-row flex-col">
              <button
                onClick={() => handlePositionAction('fix')}
                className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
              >
                {t('FixPosition')}
              </button>
              <button
                onClick={() => handlePositionAction('unfix')}
                className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
              >
                {t('UnfixPosition')}
              </button>
              <button
                onClick={() => handlePositionAction('reset')}
                className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
              >
                {t('ResetPosition')}
              </button>
            </div>
          </div>
          
          <div>
            <div className="text-xl font-bold mb-4">キャラクターBの位置設定</div>
            <div className="mb-4">{t('CharacterPositionInfo')}</div>
            <div className="mb-2 text-sm font-medium">
              {t('CurrentStatus')}:{' '}
              <span className="font-bold">
                {fixedCharacterPosition
                  ? t('PositionFixed')
                  : t('PositionNotFixed')}
              </span>
            </div>
            <div className="mb-4 text-sm">
              現在の位置: X={characterPositionB.x.toFixed(0)}, Y={characterPositionB.y.toFixed(0)}, スケール={characterPositionB.scale.toFixed(2)}
            </div>
            <div className="flex gap-4 md:flex-row flex-col">
              <button
                onClick={() => handlePositionAction('fix')}
                className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
              >
                {t('FixPosition')}
              </button>
              <button
                onClick={() => handlePositionAction('unfix')}
                className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
              >
                {t('UnfixPosition')}
              </button>
              <button
                onClick={() => handlePositionAction('reset')}
                className="px-4 py-3 text-theme font-medium bg-primary hover:bg-primary-hover active:bg-primary-press rounded-lg transition-colors duration-200 md:rounded-full md:px-6 md:py-2"
              >
                {t('ResetPosition')}
              </button>
            </div>
          </div>
        </div>

        {/* VRM Lighting Controls */}
        {modelType === 'vrm' && (
          <div className="my-6">
            <div className="text-xl font-bold mb-4">照明の強度</div>
            <div className="mb-4">
              VRMキャラクターの照明の明るさを調整します。
            </div>
            <div className="font-bold">
              照明の強度: {lightingIntensity.toFixed(1)}
            </div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.1"
              value={lightingIntensity}
              onChange={(e) => {
                const intensity = parseFloat(e.target.value)
                settingsStore.setState({ lightingIntensity: intensity })
                const { viewer } = homeStore.getState()
                if (
                  viewer &&
                  typeof viewer.updateLightingIntensity === 'function'
                ) {
                  viewer.updateLightingIntensity(intensity)
                }
              }}
              className="mt-2 mb-4 input-range"
            />
          </div>
        )}

        <div className="my-6 mb-2">
          <div className="my-4 text-xl font-bold">
            {t('CharacterSettingsPrompt')}
          </div>
          <div className="my-4 whitespace-pre-line">
            {t('CharacterSettingsInfo')}
          </div>
        </div>

        {/* プロンプトファイル編集セクション */}
        <div className="my-6 space-y-6">
          <div className="border border-gray-300 rounded-lg p-4 bg-white bg-opacity-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-bold">{characterAName} のプロンプトファイル</div>
                <div className="text-sm text-text2">{promptFileAPath}</div>
              </div>
              <TextButton onClick={() => handleSavePromptFile('A')}>
                保存
              </TextButton>
            </div>
            {isLoadingPrompt ? (
              <div className="text-center py-4">読み込み中...</div>
            ) : (
              <textarea
                value={promptFileAContent}
                onChange={(e) => setPromptFileAContent(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-md w-full h-64 text-sm font-mono"
                placeholder="プロンプトファイルの内容を入力してください..."
              />
            )}
          </div>

          <div className="border border-gray-300 rounded-lg p-4 bg-white bg-opacity-50">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-lg font-bold">{characterBName} のプロンプトファイル</div>
                <div className="text-sm text-text2">{promptFileBPath}</div>
              </div>
              <TextButton onClick={() => handleSavePromptFile('B')}>
                保存
              </TextButton>
            </div>
            {isLoadingPrompt ? (
              <div className="text-center py-4">読み込み中...</div>
            ) : (
              <textarea
                value={promptFileBContent}
                onChange={(e) => setPromptFileBContent(e.target.value)}
                className="px-3 py-2 bg-white border border-gray-300 rounded-md w-full h-64 text-sm font-mono"
                placeholder="プロンプトファイルの内容を入力してください..."
              />
            )}
          </div>
        </div>
        {/* キャラクタープリセット機能は現在使用していないため、非表示 */}
        {/* <div className="my-4 whitespace-pre-line">
          {t('CharacterpresetInfo')}
        </div>
        <div className="my-6 mb-2">
          <div className="flex flex-wrap gap-2 mb-4" role="tablist">
            {characterPresets.map(({ key, value }, index) => {
              const customName = customPresetNames[index]
              const isSelected = selectedPresetIndex === index

              return (
                <button
                  key={key}
                  onClick={() => {
                    // プリセット選択時に内容を表示し、systemPromptも更新
                    settingsStore.setState({
                      selectedPresetIndex: index,
                      systemPrompt: value,
                    })

                    toastStore.getState().addToast({
                      message: t('Toasts.PresetSwitching', {
                        presetName: customName,
                      }),
                      type: 'info',
                      tag: `character-preset-switching`,
                    })
                  }}
                  role="tab"
                  aria-selected={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      settingsStore.setState({
                        selectedPresetIndex: index,
                        systemPrompt: value,
                      })

                      toastStore.getState().addToast({
                        message: t('Toasts.PresetSwitching', {
                          presetName: customName,
                        }),
                        type: 'info',
                        tag: `character-preset-switching`,
                      })
                    }
                  }}
                  className={`px-4 py-2 rounded-md text-sm ${
                    isSelected
                      ? 'bg-primary text-theme'
                      : 'bg-surface1 hover:bg-surface1-hover text-gray-800 bg-white'
                  }`}
                >
                  {customName}
                </button>
              )
            })}
          </div>

          {characterPresets.map(({ key }, index) => {
            const customNameKey =
              `customPresetName${index + 1}` as keyof Character
            const customName = customPresetNames[index]
            const isSelected = selectedPresetIndex === index

            if (!isSelected) return null

            return (
              <div key={key} className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => {
                      settingsStore.setState({
                        [customNameKey]: e.target.value,
                      })
                    }}
                    aria-label={t('PresetNameLabel', {
                      defaultValue: 'Preset Name',
                    })}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm w-full"
                    placeholder={t(`Characterpreset${index + 1}`)}
                  />
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => {
                    const newValue = e.target.value
                    // システムプロンプトとプリセットの内容を同時に更新
                    settingsStore.setState({
                      systemPrompt: newValue,
                      [key]: newValue,
                    })
                  }}
                  aria-label={t('SystemPromptLabel', {
                    defaultValue: 'System Prompt',
                  })}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-md w-full h-64 text-sm"
                />
              </div>
            )
          })}
        </div>
      </div>
        */}
      </div>
    </>
  )
}
export default Character
