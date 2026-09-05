import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppVideoPlayer from '../../../src/components/video-mode/AppVideoPlayer.vue'

describe('AppVideoPlayer.vue', () => {
  it('renders video element and custom controls', () => {
    const wrapper = mount(AppVideoPlayer, {
      props: {
        src: 'https://example.com/test.mp4',
        poster: 'https://example.com/cover.jpg',
        referenceImage: 'https://example.com/ref.png',
      },
      global: {
        stubs: {
          NFlex: {
            template: '<div class="n-flex"><slot /></div>',
          },
          NButton: {
            template: '<button class="n-button"><slot name="icon" /><slot /></button>',
          },
          NIcon: {
            template: '<span class="n-icon"><slot /></span>',
          },
          NText: {
            template: '<span class="n-text"><slot /></span>',
          },
          NPopselect: {
            template: '<div class="n-popselect"><slot /></div>',
          },
        },
      },
    })

    const video = wrapper.find('video')
    expect(video.exists()).toBe(true)
    expect(video.attributes('src')).toBe('https://example.com/test.mp4')
    expect(video.attributes('poster')).toBe('https://example.com/cover.jpg')
    expect(wrapper.find('.app-video-player__controls').exists()).toBe(true)
  })
})
