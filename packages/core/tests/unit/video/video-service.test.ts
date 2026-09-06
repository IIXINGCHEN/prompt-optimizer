import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  VideoService,
  createVideoService,
  createVideoModelManager,
  createVideoAdapterRegistry,
  AbstractVideoProviderAdapter,
  type VideoModelConfig,
  type Image2VideoRequest,
  type VideoTask,
} from '../../../src/services/video'
import { MemoryStorageProvider } from '../../../src/services/storage/memoryStorageProvider'
import { VIDEO_ERROR_CODES } from '../../../src/constants/error-codes'

describe('VideoService & VideoModelManager', () => {
  let storageProvider: MemoryStorageProvider
  let registry: ReturnType<typeof createVideoAdapterRegistry>
  let modelManager: ReturnType<typeof createVideoModelManager>
  let videoService: VideoService

  beforeEach(async () => {
    storageProvider = new MemoryStorageProvider()
    registry = createVideoAdapterRegistry()
    modelManager = createVideoModelManager(storageProvider, registry)
    await modelManager.ensureInitialized!()
    videoService = new VideoService(modelManager, registry)
  })

  it('initializes default video model configs correctly', async () => {
    const configs = await modelManager.getAllConfigs()
    expect(configs.length).toBeGreaterThanOrEqual(2)

    const wanConfig = configs.find((c) => c.providerId === 'dashscope')
    expect(wanConfig).toBeDefined()
    expect(wanConfig?.modelId).toBe('wanx2.1-i2v-plus')
    expect(wanConfig?.model.capabilities.image2video).toBe(true)

    const sfConfig = configs.find((c) => c.providerId === 'siliconflow')
    expect(sfConfig).toBeDefined()
    expect(sfConfig?.modelId).toBe('THUDM/CogVideoX-5b-I2V')
  })

  it('validates request rejects empty prompt', async () => {
    const configs = await modelManager.getAllConfigs()
    const validConfigId = configs[0].id

    const req: Image2VideoRequest = {
      prompt: '   ',
      configId: validConfigId,
      inputImage: { b64: 'fake-b64' },
    }

    await expect(videoService.validateRequest(req)).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.PROMPT_EMPTY,
    })
  })

  it('validates request rejects missing input image', async () => {
    const configs = await modelManager.getAllConfigs()
    const validConfigId = configs[0].id

    const req: Image2VideoRequest = {
      prompt: 'Cinematic camera moving',
      configId: validConfigId,
      inputImage: {} as any,
    }

    await expect(videoService.validateRequest(req)).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED,
    })
  })

  it('validates request rejects non-existent config', async () => {
    const req: Image2VideoRequest = {
      prompt: 'Camera zoom in',
      configId: 'non-existent-config',
      inputImage: { b64: 'fake-b64' },
    }

    await expect(videoService.validateRequest(req)).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.CONFIG_NOT_FOUND,
    })
  })

  it('validates request rejects endImage when model does not support it', async () => {
    const configs = await modelManager.getAllConfigs()
    const wanConfig = configs.find((c) => c.providerId === 'dashscope')!
    await modelManager.updateConfig(wanConfig.id, { enabled: true })

    const req: Image2VideoRequest = {
      prompt: 'Camera panning',
      configId: wanConfig.id,
      inputImage: { b64: 'fake-b64' },
      endImage: { b64: 'end-b64' },
    }

    await expect(videoService.validateRequest(req)).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.MODEL_NOT_SUPPORT_END_FRAME,
    })
  })

  it('runs progressive polling engine and resolves on success', async () => {
    // Create a mock adapter with controlled task progression
    class MockVideoAdapter extends AbstractVideoProviderAdapter {
      private queryCount = 0

      getProvider() {
        return {
          id: 'mock-provider',
          name: 'Mock Provider',
          requiresApiKey: true,
          supportsDynamicModels: false,
        }
      }
      getModels() {
        return [
          {
            id: 'mock-model',
            name: 'Mock Model',
            providerId: 'mock-provider',
            capabilities: {
              image2video: true,
              supportedDurations: [5],
              supportedRatios: ['16:9'],
            },
            parameterDefinitions: [],
          },
        ]
      }
      protected getParameterDefinitions() {
        return []
      }
      protected getDefaultParameterValues() {
        return {}
      }

      async submitTask() {
        return { taskId: 'mock-task-123' }
      }

      async queryTask(taskId: string, config: VideoModelConfig): Promise<VideoTask> {
        this.queryCount++
        if (this.queryCount === 1) {
          return {
            taskId,
            configId: config.id,
            status: 'queued',
            progressPercent: 20,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
        if (this.queryCount === 2) {
          return {
            taskId,
            configId: config.id,
            status: 'processing',
            progressPercent: 65,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          }
        }
        return {
          taskId,
          configId: config.id,
          status: 'succeeded',
          progressPercent: 100,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          result: {
            video: {
              url: 'https://example.com/video.mp4',
              duration: 5,
              mimeType: 'video/mp4',
            },
          },
        }
      }

      // Override sleep to run instantly in tests
      protected async sleep() {
        return Promise.resolve()
      }
    }

    const mockAdapter = new MockVideoAdapter()
    const mockConfig: VideoModelConfig = {
      id: 'mock-config-1',
      name: 'Mock Config',
      providerId: 'mock-provider',
      modelId: 'mock-model',
      enabled: true,
      provider: mockAdapter.getProvider(),
      model: mockAdapter.getModels()[0],
    }

    const onStatusChange = vi.fn()
    const onPollingTick = vi.fn()
    const onComplete = vi.fn()

    const result = await mockAdapter.generateVideo(
      {
        prompt: 'Test video prompt',
        configId: mockConfig.id,
        inputImage: { b64: 'fake-b64' },
      },
      mockConfig,
      { onStatusChange, onPollingTick, onComplete }
    )

    expect(result.video.url).toBe('https://example.com/video.mp4')
    expect(onStatusChange).toHaveBeenCalledWith('queued', 20)
    expect(onStatusChange).toHaveBeenCalledWith('processing', 65)
    expect(onStatusChange).toHaveBeenCalledWith('succeeded', 100)
    expect(onComplete).toHaveBeenCalled()
  })

  it('handles user cancellation with AbortSignal', async () => {
    class MockSlowAdapter extends AbstractVideoProviderAdapter {
      getProvider() {
        return { id: 'slow', name: 'Slow', requiresApiKey: true, supportsDynamicModels: false }
      }
      getModels() {
        return [
          {
            id: 'm',
            name: 'M',
            providerId: 'slow',
            capabilities: { image2video: true, supportedDurations: [5], supportedRatios: ['16:9'] },
            parameterDefinitions: [],
          },
        ]
      }
      protected getParameterDefinitions() { return [] }
      protected getDefaultParameterValues() { return {} }
      async submitTask() { return { taskId: 'task-cancel' } }
      async queryTask(taskId: string, config: VideoModelConfig): Promise<VideoTask> {
        return { taskId, configId: config.id, status: 'processing', createdAt: Date.now(), updatedAt: Date.now() }
      }
    }

    const adapter = new MockSlowAdapter()
    const config: VideoModelConfig = {
      id: 'slow-cfg',
      name: 'Slow',
      providerId: 'slow',
      modelId: 'm',
      enabled: true,
      provider: adapter.getProvider(),
      model: adapter.getModels()[0],
    }

    const controller = new AbortController()
    controller.abort() // Pre-aborted

    await expect(
      adapter.generateVideo(
        { prompt: 'test', configId: 'slow-cfg', inputImage: { b64: 'b64' } },
        config,
        undefined,
        controller.signal
      )
    ).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.TASK_CANCELLED,
    })
  })
})
