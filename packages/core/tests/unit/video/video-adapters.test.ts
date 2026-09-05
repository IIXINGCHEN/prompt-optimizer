import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DashScopeVideoAdapter } from '../../../src/services/video/adapters/dashscope'
import { SiliconFlowVideoAdapter } from '../../../src/services/video/adapters/siliconflow'
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
      expect.stringContaining('/services/aigc/video-generation/video-synthesis'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': 'Bearer test-dashscope-key',
        }),
      })
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
