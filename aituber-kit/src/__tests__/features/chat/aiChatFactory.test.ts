import { getAIChatResponseStream } from '../../../features/chat/aiChatFactory'
import { getVercelAIChatResponseStream } from '../../../features/chat/vercelAIChat'
import { Message } from '../../../features/messages/messages'

jest.mock('../../../features/chat/vercelAIChat', () => ({
  getVercelAIChatResponseStream: jest.fn(),
}))

describe('aiChatFactory', () => {
  const testMessages: Message[] = [
    { role: 'user', content: 'こんにちは', timestamp: '2023-01-01T00:00:00Z' },
  ]

  const createMockStream = () => {
    return new ReadableStream({
      start(controller) {
        controller.enqueue('テスト応答')
        controller.close()
      },
    })
  }

  it('always delegates to the Vercel Gemini stream', async () => {
    const mockStream = createMockStream()
    ;(getVercelAIChatResponseStream as jest.Mock).mockResolvedValue(
      mockStream
    )

    const result = await getAIChatResponseStream(testMessages)

    expect(getVercelAIChatResponseStream).toHaveBeenCalledWith(testMessages)
    expect(result).toBe(mockStream)
  })
})
