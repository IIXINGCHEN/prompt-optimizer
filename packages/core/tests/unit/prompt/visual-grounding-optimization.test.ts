import { describe, expect, it, vi } from 'vitest'
import { PromptService } from '../../../src/services/prompt/service'
import { TemplateManager } from '../../../src/services/template/manager'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import type { TextModelConfig } from '../../../src/services/model/types'

describe('PromptService visualGrounding and engineDialect injection', () => {
  const dummyTextModel: TextModelConfig = {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    enabled: true,
    providerId: 'deepseek',
    modelId: 'deepseek-chat',
  }

  it('renders visualGrounding and engineDialect in template messages', async () => {
    const storage = new MemoryStorageProvider()
    const mockLanguageService = { getCurrentLanguage: vi.fn().mockResolvedValue('zh-CN') }
    const templateManager = new TemplateManager(storage, mockLanguageService as any)
    const mockHistoryManager = {
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      addRecord: vi.fn(),
    }

    let capturedMessages: any[] = []
    const mockLlmService = {
      sendMessageStream: vi.fn().mockImplementation(async (messages: any[], _modelKey: string, callbacks: any) => {
        capturedMessages = messages
        callbacks?.onToken?.('Rendered result')
        callbacks?.onComplete?.({ content: 'Rendered result' })
      }),
      sendMessage: vi.fn(),
    }

    const mockModelManager = {
      getModel: vi.fn().mockResolvedValue(dummyTextModel),
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
    }

    const service = new PromptService(
      mockModelManager as any,
      mockLlmService as any,
      templateManager as any,
      mockHistoryManager as any
    )

    await service.optimizePromptStream(
      {
        optimizationMode: 'user',
        targetPrompt: '女孩转头微笑',
        templateId: 'image2video-general-optimize',
        modelKey: 'deepseek-chat',
        visualGrounding: '主体：一名穿白色衬衫的少女坐在公园长椅上。构图：中景平视。',
        engineDialect: 'wanx',
      },
      {
        onToken: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      }
    )

    expect(capturedMessages.length).toBeGreaterThanOrEqual(1)
    const userMsg = capturedMessages.find((m) => m.role === 'user')
    expect(userMsg).toBeDefined()
    expect(userMsg.content).toContain('主体：一名穿白色衬衫的少女坐在公园长椅上')
    expect(userMsg.content).toContain('wanx')
  })
})
