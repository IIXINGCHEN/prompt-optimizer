import { describe, expect, it } from 'vitest'
import { isVisionCapableModel } from '../../../src/services/model/model-utils'
import type { TextModelConfig } from '../../../src/services/model/types'

describe('isVisionCapableModel', () => {
  it('returns false for null or undefined config', () => {
    expect(isVisionCapableModel(null)).toBe(false)
    expect(isVisionCapableModel(undefined)).toBe(false)
  })

  it('recognizes explicit capabilities', () => {
    const visionConfig: TextModelConfig = {
      id: 'custom-1',
      name: 'Custom 1',
      enabled: true,
      modelMeta: {
        id: 'c-1',
        name: 'C 1',
        providerId: 'p',
        parameterDefinitions: [],
        capabilities: { supportsVision: true, supportsTools: false },
      },
    }
    expect(isVisionCapableModel(visionConfig)).toBe(true)

    const nonVisionConfig: TextModelConfig = {
      id: 'custom-2',
      name: 'Custom 2',
      enabled: true,
      modelMeta: {
        id: 'c-2',
        name: 'C 2',
        providerId: 'p',
        parameterDefinitions: [],
        capabilities: { supportsVision: false, supportsTools: false },
      },
    }
    expect(isVisionCapableModel(nonVisionConfig)).toBe(false)
  })

  it('correctly identifies pure text models', () => {
    const deepseekConfig: TextModelConfig = {
      id: 'deepseek-v3',
      name: 'DeepSeek V3',
      enabled: true,
      modelId: 'deepseek-chat',
      providerId: 'deepseek',
    }
    expect(isVisionCapableModel(deepseekConfig)).toBe(false)

    const o1MiniConfig: TextModelConfig = {
      id: 'o1-mini-model',
      name: 'o1-mini',
      enabled: true,
      modelId: 'o1-mini',
      providerId: 'openai',
    }
    expect(isVisionCapableModel(o1MiniConfig)).toBe(false)

    const qwenTextConfig: TextModelConfig = {
      id: 'qwen-max',
      name: 'Qwen Max',
      enabled: true,
      modelId: 'qwen-max',
      providerId: 'dashscope',
    }
    expect(isVisionCapableModel(qwenTextConfig)).toBe(false)
  })

  it('correctly identifies vision multimodal models', () => {
    const geminiConfig: TextModelConfig = {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      enabled: true,
      modelId: 'gemini-1.5-flash',
      providerId: 'google',
    }
    expect(isVisionCapableModel(geminiConfig)).toBe(true)

    const gpt4oConfig: TextModelConfig = {
      id: 'gpt-4o',
      name: 'GPT-4o',
      enabled: true,
      modelId: 'gpt-4o',
      providerId: 'openai',
    }
    expect(isVisionCapableModel(gpt4oConfig)).toBe(true)

    const qwenVlConfig: TextModelConfig = {
      id: 'qwen-vl-max',
      name: 'Qwen VL Max',
      enabled: true,
      modelId: 'qwen-vl-max',
      providerId: 'dashscope',
    }
    expect(isVisionCapableModel(qwenVlConfig)).toBe(true)
  })
})
