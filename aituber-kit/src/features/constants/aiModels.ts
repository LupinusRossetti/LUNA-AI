export const defaultModel = 'gemini-2.0-flash'
export const supportedModels = ['gemini-2.0-flash', 'gemini-1.5-flash'] as const
export const googleSearchGroundingModels = ['gemini-2.0-flash', 'gemini-2.0-flash-exp'] as const

export const getDefaultModel = () => defaultModel

export const isMultiModalAvailable = (..._args: any[]) => true




