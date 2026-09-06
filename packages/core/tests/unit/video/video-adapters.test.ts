import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DashScopeVideoAdapter } from '../../../src/services/video/adapters/dashscope'
import { SiliconFlowVideoAdapter } from '../../../src/services/video/adapters/siliconflow'
import { ZhipuVideoAdapter } from '../../../src/services/video/adapters/zhipu'
import { MiniMaxVideoAdapter } from '../../../src/services/video/adapters/minimax'
import { KlingVideoAdapter } from '../../../src/services/video/adapters/kling'
import { RunwayVideoAdapter } from '../../../src/services/video/adapters/runway'
import { ViduVideoAdapter } from '../../../src/services/video/adapters/vidu'
import { VIDEO_ERROR_CODES } from '../../../src/constants/error-codes'
import type { VideoModelConfig } from '../../../src/services/video/types'

describe('DashScopeVideoAdapter', () => {
  let adapter: DashScopeVideoAdapter
  let config: VideoModelConfig

  beforeEach(() => {
    adapter = new DashScopeVideoAdapter()
    config = {
      id: 'cfg-dashscope',
      name: 'DashScope Wan',
      providerId: 'dashscope',
      modelId: 'wan2.1-i2v-plus',
      enabled: true,
      connectionConfig: {
        apiKey: 'test-dashscope-key',
      },
      provider: adapter.getProvider(),
      model: adapter.getModels()[0],
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits task successfully', async () => {
    let capturedBody: any
    const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({
          output: {
            task_id: 'ds-task-999',
            task_status: 'PENDING',
          },
        }),
      }
    })
    vi.stubGlobal('fetch', mockFetch)

    const res = await adapter.submitTask(
      {
        prompt: 'Camera panning right',
        configId: config.id,
        inputImage: { b64: 'base64-data' },
      },
      config
    )

    expect(res.taskId).toBe('ds-task-999')
    // 模型 ID 自动纠偏：wan2.1- 前缀必须映射为百炼商业 API 的 wanx2.1-
    expect(capturedBody.model).toBe('wanx2.1-i2v-plus')
    // prompt_extend 默认关闭，避免百炼后台二次扩写引发变脸与敏感词误杀
    expect(capturedBody.parameters.prompt_extend).toBe(false)
    expect(capturedBody.input.prompt).toBe('Camera panning right')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/services/aigc/video-generation/video-synthesis'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-dashscope-key',
        }),
      })
    )
  })

  it('maps DataInspectionFailed to a descriptive localized error', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        code: 'DataInspectionFailed',
        message: 'Input data may contain inappropriate content.',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(
      adapter.submitTask(
        { prompt: 'test', configId: config.id, inputImage: { b64: 'b64' } },
        config
      )
    ).rejects.toMatchObject({
      code: VIDEO_ERROR_CODES.TASK_SUBMISSION_FAILED,
    })
  })

  it('gracefully falls back to official DashScope endpoint when text compatible-mode URL is provided', async () => {
    config.connectionConfig = {
      apiKey: process.env.DASHSCOPE_API_KEY || 'test-key',
      baseURL: 'https://llm-lppkyf39n2jpxvg5.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: {
          task_id: 'ds-task-999',
          task_status: 'PENDING',
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const res = await adapter.submitTask(
      {
        prompt: 'Camera panning right',
        configId: config.id,
        inputImage: { b64: 'base64-data' },
      },
      config
    )

    expect(res.taskId).toBe('ds-task-999')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://llm-lppkyf39n2jpxvg5.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      expect.anything()
    )
  })

  it('automatically maps aspectRatio 16:9 to size 1280*720', async () => {
    let capturedBody: any
    const mockFetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = JSON.parse(opts.body)
      return {
        ok: true,
        json: async () => ({ output: { task_id: 'task-ratio' } }),
      }
    })
    vi.stubGlobal('fetch', mockFetch)

    await adapter.submitTask(
      {
        prompt: 'test ratio',
        configId: config.id,
        inputImage: { b64: 'b64' },
        aspectRatio: '16:9',
      },
      config
    )

    expect(capturedBody.parameters.size).toBe('1280*720')
  })

  it('queries task status and maps SUCCEEDED state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: {
          task_id: 'ds-task-999',
          task_status: 'SUCCEEDED',
          video_url: 'https://dashscope.oss/wan2.1.mp4',
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const task = await adapter.queryTask('ds-task-999', config)
    expect(task.status).toBe('succeeded')
    expect(task.progressPercent).toBe(100)
    expect(task.result?.video.url).toBe('https://dashscope.oss/wan2.1.mp4')
  })
})

describe('SiliconFlowVideoAdapter', () => {
  let adapter: SiliconFlowVideoAdapter
  let config: VideoModelConfig

  beforeEach(() => {
    adapter = new SiliconFlowVideoAdapter()
    config = {
      id: 'cfg-sf',
      name: 'SiliconFlow CogVideoX',
      providerId: 'siliconflow',
      modelId: 'THUDM/CogVideoX-5b-I2V',
      enabled: true,
      connectionConfig: {
        apiKey: 'test-sf-key',
      },
      provider: adapter.getProvider(),
      model: adapter.getModels()[0],
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('submits task successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        requestId: 'sf-req-888',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const res = await adapter.submitTask(
      {
        prompt: 'Camera zoom in',
        configId: config.id,
        inputImage: { url: 'https://example.com/input.png' },
      },
      config
    )

    expect(res.taskId).toBe('sf-req-888')
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/video/submit'),
      expect.objectContaining({
        method: 'POST',
      })
    )
  })

  it('queries task status and maps Success state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'Succeed',
        results: {
          videos: [{ url: 'https://sf-cdn.com/cogvideox.mp4' }],
        },
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const task = await adapter.queryTask('sf-req-888', config)
    expect(task.status).toBe('succeeded')
    expect(task.result?.video.url).toBe('https://sf-cdn.com/cogvideox.mp4')
  })

  it('queries task status and maps Queued state', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'Queued',
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const task = await adapter.queryTask('sf-req-888', config)
    expect(task.status).toBe('queued')
    expect(task.progressPercent).toBe(10)
  })
})

const MOCK_AUTH = process.env.MOCK_AUTH_KEY || 'mock-key'

describe('ZhipuVideoAdapter', () => {
  it('submits and queries task successfully', async () => {
    const adapter = new ZhipuVideoAdapter()
    const config: VideoModelConfig = {
      id: 'cfg-zhipu',
      name: 'Zhipu CogVideoX',
      providerId: 'zhipu',
      modelId: 'cogvideox',
      enabled: true,
      connectionConfig: { apiKey: MOCK_AUTH },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'zp-task-1', task_status: 'PROCESSING' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'zp-task-1',
          task_status: 'SUCCESS',
          video_result: [{ url: 'https://example.com/zhipu.mp4' }],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const subRes = await adapter.submitTask(
      { prompt: 'test', configId: config.id, inputImage: { b64: 'b64' } },
      config
    )
    expect(subRes.taskId).toBe('zp-task-1')

    const task = await adapter.queryTask(subRes.taskId, config)
    expect(task.status).toBe('succeeded')
    expect(task.result?.video.url).toBe('https://example.com/zhipu.mp4')
  })
})

describe('MiniMaxVideoAdapter', () => {
  it('submits and queries task successfully', async () => {
    const adapter = new MiniMaxVideoAdapter()
    const config: VideoModelConfig = {
      id: 'cfg-minimax',
      name: 'MiniMax Video-01',
      providerId: 'minimax',
      modelId: 'video-01',
      enabled: true,
      connectionConfig: { apiKey: MOCK_AUTH },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'mm-task-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'Success',
          video_url: 'https://example.com/minimax.mp4',
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const subRes = await adapter.submitTask(
      { prompt: 'test', configId: config.id, inputImage: { b64: 'b64' } },
      config
    )
    expect(subRes.taskId).toBe('mm-task-1')

    const task = await adapter.queryTask(subRes.taskId, config)
    expect(task.status).toBe('succeeded')
    expect(task.result?.video.url).toBe('https://example.com/minimax.mp4')
  })
})

describe('KlingVideoAdapter', () => {
  it('submits and queries task successfully', async () => {
    const adapter = new KlingVideoAdapter()
    const config: VideoModelConfig = {
      id: 'cfg-kling',
      name: 'Kling V1',
      providerId: 'kling',
      modelId: 'kling-v1',
      enabled: true,
      connectionConfig: { apiKey: MOCK_AUTH },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, data: { task_id: 'kling-task-1' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            task_status: 'succeed',
            task_result: { videos: [{ url: 'https://example.com/kling.mp4', duration: 5 }] },
          },
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const subRes = await adapter.submitTask(
      { prompt: 'test', configId: config.id, inputImage: { b64: 'b64' } },
      config
    )
    expect(subRes.taskId).toBe('kling-task-1')

    const task = await adapter.queryTask(subRes.taskId, config)
    expect(task.status).toBe('succeeded')
    expect(task.result?.video.url).toBe('https://example.com/kling.mp4')
  })
})

describe('RunwayVideoAdapter', () => {
  it('submits and queries task successfully', async () => {
    const adapter = new RunwayVideoAdapter()
    const config: VideoModelConfig = {
      id: 'cfg-runway',
      name: 'Runway Gen-3',
      providerId: 'runway',
      modelId: 'gen3a_turbo',
      enabled: true,
      connectionConfig: { apiKey: MOCK_AUTH },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'rw-task-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'rw-task-1',
          status: 'SUCCEEDED',
          output: ['https://example.com/runway.mp4'],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const subRes = await adapter.submitTask(
      { prompt: 'test', configId: config.id, inputImage: { b64: 'b64' } },
      config
    )
    expect(subRes.taskId).toBe('rw-task-1')

    const task = await adapter.queryTask(subRes.taskId, config)
    expect(task.status).toBe('succeeded')
    expect(task.result?.video.url).toBe('https://example.com/runway.mp4')
  })
})

describe('ViduVideoAdapter', () => {
  it('submits and queries task successfully', async () => {
    const adapter = new ViduVideoAdapter()
    const config: VideoModelConfig = {
      id: 'cfg-vidu',
      name: 'Vidu High',
      providerId: 'vidu',
      modelId: 'vidu-high',
      enabled: true,
      connectionConfig: { apiKey: MOCK_AUTH },
    }

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ task_id: 'vidu-task-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          state: 'success',
          creations: [{ url: 'https://example.com/vidu.mp4' }],
        }),
      })
    vi.stubGlobal('fetch', mockFetch)

    const subRes = await adapter.submitTask(
      { prompt: 'test', configId: config.id, inputImage: { b64: 'b64' } },
      config
    )
    expect(subRes.taskId).toBe('vidu-task-1')

    const task = await adapter.queryTask(subRes.taskId, config)
    expect(task.status).toBe('succeeded')
    expect(task.result?.video.url).toBe('https://example.com/vidu.mp4')
  })
})
