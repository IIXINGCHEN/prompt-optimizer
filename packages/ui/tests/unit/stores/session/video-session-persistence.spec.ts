import { describe, it, expect, vi } from 'vitest'
import { createTestPinia } from '../../../utils/pinia-test-helpers'
import { useVideoImage2VideoSession } from '../../../../src/stores/session/useVideoImage2VideoSession'
import { VIDEO_IMAGE2VIDEO_SESSION_KEY } from '../../../../src/stores/session/imageStorageMaintenance'

describe('useVideoImage2VideoSession persistence', () => {
  it('saves large base64 image into imageStorageService and keeps snapshot small', async () => {
    const set = vi.fn(async (_key: string, _value: any) => {})
    const savedImages = new Map<string, any>()
    const saveImage = vi.fn(async (data: any) => {
      savedImages.set(data.metadata.id, data)
      return data.metadata.id
    })
    const getMetadata = vi.fn(async (id: string) => savedImages.get(id)?.metadata || null)
    const getImage = vi.fn(async (id: string) => savedImages.get(id) || null)

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
        set,
        delete: async () => {},
        keys: async () => [],
        clear: async () => {},
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata,
        getImage,
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useVideoImage2VideoSession(pinia)
    // Create large 2MB dummy base64 string
    const largeB64 = 'A'.repeat(2 * 1024 * 1024)
    store.inputImageB64 = `data:image/png;base64,${largeB64}`
    store.inputImageMime = 'image/png'
    store.originalPrompt = 'A cinematic shot of a sunset'

    await store.saveSession()

    expect(saveImage).toHaveBeenCalledTimes(1)
    expect(set).toHaveBeenCalledWith(VIDEO_IMAGE2VIDEO_SESSION_KEY, expect.any(String))

    const raw = set.mock.calls[0]?.[1]
    expect(typeof raw).toBe('string')
    // Snapshot size must be much smaller than 1MB (1048576 bytes)
    const byteLength = new TextEncoder().encode(raw).byteLength
    expect(byteLength).toBeLessThan(5000)

    const parsed = JSON.parse(raw)
    expect(parsed.inputImageId).toBeTruthy()
    expect(parsed.inputImageB64).toBeUndefined()
    expect(parsed.originalPrompt).toBe('A cinematic shot of a sunset')
  })

  it('restores image from imageStorageService on restoreSession', async () => {
    const testB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const savedImages = new Map<string, any>([
      [
        'img_saved_123',
        {
          metadata: { id: 'img_saved_123', mimeType: 'image/png', sizeBytes: 100 },
          data: testB64,
        },
      ],
    ])

    const snapshot = {
      originalPrompt: 'prompt test',
      optimizedPrompt: 'optimized test',
      reasoning: 'reasoning test',
      inputImageId: 'img_saved_123',
      inputImageMime: 'image/png',
      variants: {},
      variantResults: {},
    }

    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(key: string, defaultValue: T) => {
          if (key === VIDEO_IMAGE2VIDEO_SESSION_KEY) {
            return JSON.stringify(snapshot) as any
          }
          return defaultValue
        },
        set: vi.fn(),
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getMetadata: vi.fn(async (id: string) => savedImages.get(id)?.metadata || null),
        getImage: vi.fn(async (id: string) => savedImages.get(id) || null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useVideoImage2VideoSession(pinia)
    await store.restoreSession()

    expect(store.originalPrompt).toBe('prompt test')
    expect(store.optimizedPrompt).toBe('optimized test')
    expect(store.inputImageId).toBe('img_saved_123')
    expect(store.inputImageB64).toBe(`data:image/png;base64,${testB64}`)
    expect(store.inputImageMime).toBe('image/png')
  })

  it('sanitizes large data URLs in variantResults', async () => {
    const set = vi.fn(async (_key: string, _value: any) => {})
    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
        set,
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getMetadata: vi.fn(async () => null),
        getImage: vi.fn(),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useVideoImage2VideoSession(pinia)
    store.variantResults.a = {
      video: {
        url: `data:video/mp4;base64,${'B'.repeat(2 * 1024 * 1024)}`,
        coverImageUrl: `data:image/png;base64,${'C'.repeat(1024 * 1024)}`,
      },
      metadata: {
        providerId: 'test',
        modelId: 'test-model',
        configId: 'cfg',
        taskId: 'task-1',
      },
    }

    await store.saveSession()

    expect(set).toHaveBeenCalled()
    const raw = set.mock.calls[0]?.[1]
    const byteLength = new TextEncoder().encode(raw).byteLength
    expect(byteLength).toBeLessThan(5000)

    const parsed = JSON.parse(raw)
    expect(parsed.variantResults.a.video.url).toBe('')
    expect(parsed.variantResults.a.video.coverImageUrl).toBe('')
    expect(parsed.variantResults.a.metadata.taskId).toBe('task-1')
  })

  it('clears inputImageId when inputImageB64 is cleared', async () => {
    const set = vi.fn(async (_key: string, _value: any) => {})
    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
        set,
      } as any,
      imageStorageService: {
        saveImage: vi.fn(async () => 'img_test'),
        getMetadata: vi.fn(async () => null),
        getImage: vi.fn(),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useVideoImage2VideoSession(pinia)
    store.inputImageB64 = 'data:image/png;base64,AAAA'
    await store.saveSession()
    expect(store.inputImageId).toBeTruthy()

    store.inputImageB64 = null
    await store.saveSession()
    expect(store.inputImageId).toBeNull()

    const lastCall = set.mock.calls.at(-1)?.[1]
    const parsed = JSON.parse(lastCall)
    expect(parsed.inputImageId).toBeNull()
  })

  it('normalizes partial/legacy variants snapshot to full a-d shape on restore', async () => {
    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(key: string, defaultValue: T) => {
          if (key === VIDEO_IMAGE2VIDEO_SESSION_KEY) {
            // 旧格式/损坏快照：variants 为空对象 + 非法列数
            return JSON.stringify({ originalPrompt: 'legacy', variants: {}, testColumnCount: 7 }) as any
          }
          return defaultValue
        },
        set: vi.fn(),
      } as any,
    })

    const store = useVideoImage2VideoSession(pinia)
    await store.restoreSession()

    // 归一化后必须具备完整 a-d 列，工作区模板才不会因 undefined 崩溃
    for (const id of ['a', 'b', 'c', 'd'] as const) {
      expect(store.variants[id]).toBeDefined()
      expect(store.variants[id].id).toBe(id)
      expect(typeof store.variants[id].modelKey).toBe('string')
    }
    expect(store.testColumnCount).toBe(2)
    expect(store.originalPrompt).toBe('legacy')
  })

  it('saves and restores endImage roundtrip via image storage service', async () => {
    const savedImages = new Map<string, any>()
    const saveImage = vi.fn(async (data: any) => {
      savedImages.set(data.metadata.id, data)
      return data.metadata.id
    })
    const set = vi.fn(async (_key: string, _value: any) => {})
    const { pinia } = createTestPinia({
      preferenceService: {
        get: async <T,>(_key: string, defaultValue: T) => defaultValue,
        set,
      } as any,
      imageStorageService: {
        saveImage,
        getMetadata: vi.fn(async (id: string) => savedImages.get(id)?.metadata || null),
        getImage: vi.fn(async (id: string) => savedImages.get(id) || null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })

    const store = useVideoImage2VideoSession(pinia)
    store.endImageB64 = 'data:image/png;base64,ENDDATA'
    store.endImageMime = 'image/png'
    await store.saveSession()

    const raw = set.mock.calls.at(-1)?.[1]
    const parsed = JSON.parse(raw)
    expect(parsed.endImageId).toBeTruthy()
    expect(parsed.endImageB64).toBeUndefined()

    // 模拟重开应用：从持久化快照恢复
    const snapshot = raw
    const get = vi.fn(async (key: string, defaultValue: unknown) =>
      key === VIDEO_IMAGE2VIDEO_SESSION_KEY ? snapshot : defaultValue
    )
    const { pinia: pinia2 } = createTestPinia({
      preferenceService: {
        get: get as any,
        set: vi.fn(),
      } as any,
      imageStorageService: {
        saveImage: vi.fn(),
        getMetadata: vi.fn(async (id: string) => savedImages.get(id)?.metadata || null),
        getImage: vi.fn(async (id: string) => savedImages.get(id) || null),
        listAllMetadata: vi.fn(async () => []),
        deleteImages: vi.fn(async () => {}),
      } as any,
    })
    const store2 = useVideoImage2VideoSession(pinia2)
    await store2.restoreSession()
    expect(store2.endImageId).toBe(parsed.endImageId)
    expect(store2.endImageB64).toBe('data:image/png;base64,ENDDATA')
  })
})
