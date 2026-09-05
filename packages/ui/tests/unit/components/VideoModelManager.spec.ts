import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import VideoModelManager from '../../../src/components/VideoModelManager.vue'
import { createVideoAdapterRegistry } from '@prompt-optimizer/core'

describe('VideoModelManager.vue', () => {
  let mockVideoModelManager: any
  let mockVideoService: any
  let registry: ReturnType<typeof createVideoAdapterRegistry>

  beforeEach(() => {
    registry = createVideoAdapterRegistry()
    mockVideoModelManager = {
      ensureInitialized: vi.fn().mockResolvedValue(undefined),
      getAllConfigs: vi.fn().mockResolvedValue([
        {
          id: 'video-dashscope-wan',
          name: 'Wan 2.1 I2V Plus',
          providerId: 'dashscope',
          modelId: 'wan2.1-i2v-plus',
          enabled: true,
          provider: registry.getAdapter('dashscope').getProvider(),
          model: registry.getAdapter('dashscope').getModels()[0],
        },
      ]),
      updateConfig: vi.fn().mockResolvedValue(undefined),
      deleteConfig: vi.fn().mockResolvedValue(undefined),
      addConfig: vi.fn().mockResolvedValue(undefined),
    }

    mockVideoService = {
      testConnection: vi.fn().mockResolvedValue(true),
    }
  })

  it('renders video model list and displays model cards', async () => {
    const wrapper = mount(VideoModelManager, {
      global: {
        provide: {
          videoRegistry: registry,
          videoModelManager: mockVideoModelManager,
          videoService: mockVideoService,
        },
        stubs: {
          NEmpty: true,
          NButton: true,
          NCard: {
            template: '<div class="n-card"><slot name="header" /><slot name="header-extra" /><slot /></div>',
          },
          NText: true,
          NTag: true,
          NSwitch: true,
          NPopconfirm: true,
          NSpace: true,
          VideoModelEditModal: true,
        },
      },
    })

    await vi.waitFor(() => {
      expect(mockVideoModelManager.getAllConfigs).toHaveBeenCalled()
    })

    expect(wrapper.find('.video-model-list').exists()).toBe(true)
  })

  it('calls updateConfig when saving an existing config', async () => {
    mockVideoModelManager.getConfig = vi.fn().mockImplementation(async (id: string) => {
      if (id === 'video-dashscope-wan') {
        return { id: 'video-dashscope-wan', name: 'Wan 2.1 I2V Plus' }
      }
      return null
    })

    const { useVideoModelManager } = await import('../../../src/composables/model/useVideoModelManager')
    let composable: any
    mount({
      setup() {
        composable = useVideoModelManager()
        return () => null
      },
    }, {
      global: {
        provide: {
          videoRegistry: registry,
          videoModelManager: mockVideoModelManager,
          videoService: mockVideoService,
        },
      },
    })

    const success = await composable.saveConfig({
      id: 'video-dashscope-wan',
      name: 'Wan 2.1 I2V Plus Updated',
      providerId: 'dashscope',
      modelId: 'wan2.1-i2v-plus',
      enabled: true,
      connectionConfig: { apiKey: 'new-key' },
    })

    expect(success).toBe(true)
    expect(mockVideoModelManager.updateConfig).toHaveBeenCalledWith(
      'video-dashscope-wan',
      expect.objectContaining({ name: 'Wan 2.1 I2V Plus Updated' })
    )
    expect(mockVideoModelManager.addConfig).not.toHaveBeenCalled()
  })

  it('calls addConfig when saving a brand new config', async () => {
    mockVideoModelManager.getConfig = vi.fn().mockResolvedValue(null)

    const { useVideoModelManager } = await import('../../../src/composables/model/useVideoModelManager')
    let composable: any
    mount({
      setup() {
        composable = useVideoModelManager()
        return () => null
      },
    }, {
      global: {
        provide: {
          videoRegistry: registry,
          videoModelManager: mockVideoModelManager,
          videoService: mockVideoService,
        },
      },
    })

    const success = await composable.saveConfig({
      id: 'video-custom-new',
      name: 'Custom New Video Model',
      providerId: 'dashscope',
      modelId: 'wan2.1-i2v-plus',
      enabled: true,
      connectionConfig: { apiKey: 'key' },
    })

    expect(success).toBe(true)
    expect(mockVideoModelManager.addConfig).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'video-custom-new' })
    )
    expect(mockVideoModelManager.updateConfig).not.toHaveBeenCalled()
  })
})
