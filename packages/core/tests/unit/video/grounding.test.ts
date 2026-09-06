import { describe, expect, it, vi } from 'vitest'
import { extractVisualGrounding } from '../../../src/services/video/grounding'
import { VIDEO_ERROR_CODES } from '../../../src/constants/error-codes'
import type { TextModelConfig } from '../../../src/services/model/types'

describe('extractVisualGrounding', () => {
  const dummyModelConfig: TextModelConfig = {
    id: 'vision-model-1',
    name: 'Vision Model 1',
    enabled: true,
    providerId: 'google',
    modelId: 'gemini-1.5-flash',
    providerMeta: { id: 'google', name: 'Google' },
    modelMeta: { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  }

  it('throws error if modelConfig is missing', async () => {
    await expect(
      extractVisualGrounding({
        modelConfig: null as any,
        imageB64: 'AAAA',
      })
    ).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.CONFIG_NOT_FOUND,
    })
  })

  it('throws error if imageB64 is missing or empty', async () => {
    await expect(
      extractVisualGrounding({
        modelConfig: dummyModelConfig,
        imageB64: '   ',
      })
    ).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED,
    })
  })

  it('successfully extracts grounding via imageUnderstandingService', async () => {
    const mockService = {
      understand: vi.fn().mockResolvedValue({
        content: '### 主体与姿态\n一名身穿白色衬衫的女子坐在桌边，神态平静。\n### 构图与光线\n中景平视，柔和侧逆光。',
      }),
      understandStream: vi.fn(),
    }

    const result = await extractVisualGrounding({
      modelConfig: dummyModelConfig,
      imageB64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      dynamicIntent: '女孩转头微笑',
      imageUnderstandingService: mockService as any,
    })

    expect(result).toContain('一名身穿白色衬衫的女子')
    expect(mockService.understand).toHaveBeenCalledWith(
      expect.objectContaining({
        modelConfig: dummyModelConfig,
        userPrompt: expect.stringContaining('女孩转头微笑'),
        images: [{ b64: 'iVBORw0KGgoAAAANSUhEUg==', mimeType: 'image/png' }],
      })
    )
  })
})
