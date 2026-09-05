import { describe, expect, it } from 'vitest'
import { StaticLoader } from '../../../src/services/template/static-loader'

describe('Video Prompt Templates', () => {
  const loader = new StaticLoader()
  const collection = loader.loadTemplates()

  it('loads video optimization templates for both zh and en', () => {
    const zhTemplates = collection.byType['image2videoOptimize'].zh
    const enTemplates = collection.byType['image2videoOptimize'].en

    expect(Object.keys(zhTemplates).length).toBeGreaterThanOrEqual(3)
    expect(Object.keys(enTemplates).length).toBeGreaterThanOrEqual(3)

    expect(zhTemplates['image2video-general-optimize']).toBeDefined()
    expect(zhTemplates['image2video-cinematic-optimize']).toBeDefined()
    expect(zhTemplates['image2video-character-motion-optimize']).toBeDefined()

    expect(enTemplates['image2video-general-optimize-en']).toBeDefined()
    expect(enTemplates['image2video-cinematic-optimize-en']).toBeDefined()
    expect(enTemplates['image2video-character-motion-optimize-en']).toBeDefined()
  })

  it('loads video iterate templates for both zh and en', () => {
    const zhIterate = collection.byType['videoIterate'].zh
    const enIterate = collection.byType['videoIterate'].en

    expect(zhIterate['video-iterate-general']).toBeDefined()
    expect(enIterate['video-iterate-general-en']).toBeDefined()
  })

  it('verifies general optimize template has valid structure and placeholders instruction', () => {
    const template = collection.all['image2video-general-optimize']
    expect(template).toBeDefined()
    expect(Array.isArray(template.content)).toBe(true)

    const content = template.content as Array<{ role: string; content: string }>
    const systemMsg = content.find((c) => c.role === 'system')
    const userMsg = content.find((c) => c.role === 'user')

    expect(systemMsg).toBeDefined()
    expect(systemMsg?.content).toContain('镜头运镜')
    expect(systemMsg?.content).toContain('主体动态')

    expect(userMsg).toBeDefined()
    expect(userMsg?.content).toContain('originalPrompt')
  })
})
