import {
  getVercelAIChatResponse,
  getVercelAIChatResponseStream,
} from '../../../features/chat/vercelAIChat'
import settingsStore from '../../../features/stores/settings'
import { defaultModel } from '../../../features/constants/aiModels'

jest.mock('../../../features/stores/settings', () => ({
  getState: jest.fn(),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('vercelAIChat', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(settingsStore.getState as jest.Mock).mockReturnValue({
      googleKey: 'test-google-key',
      useSearchGrounding: false,
      temperature: 0.8,
      maxTokens: 512,
      dynamicRetrievalThreshold: 0.3,
    })
  })

  const testMessages = [
    { role: 'user', content: 'hello', timestamp: '2025-01-01T00:00:00Z' },
  ]

  it('posts to /api/ai/vercel and returns text', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ text: 'ai response' }),
    })

    const result = await getVercelAIChatResponse(testMessages)

    expect(mockFetch).toHaveBeenCalledWith('/api/ai/vercel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    })
    expect(result).toEqual({ text: 'ai response' })
  })

  it('throws when the API returns an error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('error'),
    })

    await expect(getVercelAIChatResponse(testMessages)).rejects.toThrow(
      'error'
    )
  })

  it('returns the readable stream body', async () => {
    const mockBody = { getReader: jest.fn() }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: mockBody,
    })

    const stream = await getVercelAIChatResponseStream(testMessages)
    expect(stream).toBe(mockBody)
  })

  it('errors when stream response has no body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: null,
    })

    await expect(
      getVercelAIChatResponseStream(testMessages)
    ).rejects.toThrow('Response body is empty')
  })
})

