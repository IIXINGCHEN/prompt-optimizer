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
})
