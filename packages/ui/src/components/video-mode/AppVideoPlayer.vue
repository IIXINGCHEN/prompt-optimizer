<template>
  <div
    ref="playerContainerRef"
    class="app-video-player"
    :class="{ 'app-video-player--fullscreen': isFullscreen }"
    data-testid="app-video-player"
  >
    <!-- 视频主体与 Split Diff 覆盖层 -->
    <div class="app-video-player__viewport">
      <!-- 视频元素 -->
      <video
        ref="videoRef"
        class="app-video-player__video"
        :src="src"
        :poster="poster"
        :loop="isLoop"
        playsinline
        preload="metadata"
        @timeupdate="handleTimeUpdate"
        @loadedmetadata="handleLoadedMetadata"
        @ended="handleEnded"
        @play="isPlaying = true"
        @pause="isPlaying = false"
        @click="togglePlay"
      />

      <!-- 首帧对比图层 (Split Diff) -->
      <div
        v-if="isDiffMode && referenceImage"
        class="app-video-player__diff-overlay"
        :style="{ clipPath: `inset(0 ${100 - diffPosition}% 0 0)` }"
      >
        <img
          :src="referenceImage"
          class="app-video-player__diff-image"
          alt="Original First Frame"
        />
        <div class="app-video-player__diff-tag left">
          {{ t('video.player.originalImage') }}
        </div>
      </div>

      <div
        v-if="isDiffMode && referenceImage"
        class="app-video-player__diff-tag right"
      >
        {{ t('video.player.generatedVideo') }}
      </div>

      <!-- 分割滑块 -->
      <div
        v-if="isDiffMode && referenceImage"
        class="app-video-player__diff-slider"
        :style="{ left: `${diffPosition}%` }"
        @mousedown="startDiffDrag"
        @touchstart="startDiffDrag"
      >
        <div class="diff-slider-handle">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M8.5 7l-5 5 5 5V7zm7 10l5-5-5-5v10z" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 播放器悬浮控制栏 -->
    <div class="app-video-player__controls">
      <!-- 进度条 -->
      <div class="app-video-player__progressbar-wrap" @click="handleSeekClick">
        <div
          class="app-video-player__progressbar-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <NFlex justify="space-between" align="center" :wrap="false" class="app-video-player__bar">
        <!-- 左侧控制：播放/暂停、逐帧、时间 -->
        <NFlex align="center" :size="8">
          <NButton text size="small" @click="togglePlay" :title="isPlaying ? t('video.player.pause') : t('video.player.play')">
            <template #icon>
              <NIcon size="18">
                <svg v-if="isPlaying" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </NIcon>
            </template>
          </NButton>

          <!-- 逐帧后退 -->
          <NButton text size="tiny" @click="stepFrame(-1)" :title="t('video.player.prevFrame')">
            <template #icon>
              <NIcon size="14">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
              </NIcon>
            </template>
          </NButton>

          <!-- 逐帧前进 -->
          <NButton text size="tiny" @click="stepFrame(1)" :title="t('video.player.nextFrame')">
            <template #icon>
              <NIcon size="14">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
              </NIcon>
            </template>
          </NButton>

          <NText depth="3" style="font-size: 11px; font-variant-numeric: tabular-nums;">
            {{ formattedCurrentTime }} / {{ formattedDuration }}
          </NText>
        </NFlex>

        <!-- 右侧控制：首帧对比切换、循环、倍速、下载、全屏 -->
        <NFlex align="center" :size="10">
          <NButton
            v-if="referenceImage"
            size="tiny"
            round
            :type="isDiffMode ? 'primary' : 'default'"
            @click="isDiffMode = !isDiffMode"
            :title="t('video.player.diffTooltip')"
          >
            {{ t('video.player.diffButton') }}
          </NButton>

          <NButton
            size="tiny"
            round
            :type="isLoop ? 'primary' : 'default'"
            @click="isLoop = !isLoop"
            :title="t('video.player.loopTooltip')"
          >
            {{ t('video.player.loop') }}
          </NButton>

          <NPopselect
            v-model:value="playbackRate"
            :options="speedOptions"
            size="small"
            trigger="click"
            @update:value="handleRateChange"
          >
            <NButton text size="tiny" style="font-size: 11px;">
              {{ playbackRate }}x
            </NButton>
          </NPopselect>

          <NButton text size="small" @click="downloadVideo" :title="t('video.player.download')">
            <template #icon>
              <NIcon size="16">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
              </NIcon>
            </template>
          </NButton>

          <NButton text size="small" @click="toggleFullscreen" :title="t('video.player.fullscreen')">
            <template #icon>
              <NIcon size="16">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
              </NIcon>
            </template>
          </NButton>
        </NFlex>
      </NFlex>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { NFlex, NButton, NIcon, NText, NPopselect } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    src: string
    poster?: string
    referenceImage?: string
    autoPlay?: boolean
  }>(),
  {
    poster: undefined,
    referenceImage: undefined,
    autoPlay: false,
  }
)

const { t } = useI18n()

const playerContainerRef = ref<HTMLDivElement | null>(null)
const videoRef = ref<HTMLVideoElement | null>(null)

const isPlaying = ref(false)
const isLoop = ref(true)
const isFullscreen = ref(false)
const isDiffMode = ref(false)
const diffPosition = ref(50) // percentage
const isDraggingDiff = ref(false)

const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref(1)

const speedOptions = [
  { label: '0.5x', value: 0.5 },
  { label: '1.0x', value: 1.0 },
  { label: '1.5x', value: 1.5 },
  { label: '2.0x', value: 2.0 },
]

const progressPercent = computed(() => {
  if (duration.value <= 0) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const formattedCurrentTime = computed(() => formatTime(currentTime.value))
const formattedDuration = computed(() => formatTime(duration.value))

const togglePlay = () => {
  if (!videoRef.value) return
  if (videoRef.value.paused) {
    videoRef.value.play()
  } else {
    videoRef.value.pause()
  }
}

const handleTimeUpdate = () => {
  if (!videoRef.value) return
  currentTime.value = videoRef.value.currentTime
}

const handleLoadedMetadata = () => {
  if (!videoRef.value) return
  duration.value = videoRef.value.duration
  if (props.autoPlay) {
    videoRef.value.play().catch(() => {})
  }
}

const handleEnded = () => {
  if (!isLoop.value) {
    isPlaying.value = false
  }
}

const handleRateChange = (rate: number) => {
  playbackRate.value = rate
  if (videoRef.value) {
    videoRef.value.playbackRate = rate
  }
}

const stepFrame = (frames: number) => {
  if (!videoRef.value) return
  videoRef.value.pause()
  const frameTime = 1 / 25 // 25 fps estimate
  videoRef.value.currentTime = Math.max(0, Math.min(duration.value, videoRef.value.currentTime + frames * frameTime))
}

const handleSeekClick = (e: MouseEvent) => {
  if (!videoRef.value || duration.value <= 0) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const ratio = Math.max(0, Math.min(1, clickX / rect.width))
  videoRef.value.currentTime = ratio * duration.value
}

const downloadVideo = async () => {
  if (!props.src) return
  try {
    const res = await fetch(props.src)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `video_${Date.now()}.mp4`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  } catch {
    const a = document.createElement('a')
    a.href = props.src
    a.download = `video_${Date.now()}.mp4`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
}

const toggleFullscreen = () => {
  if (!playerContainerRef.value) return
  if (!document.fullscreenElement) {
    playerContainerRef.value.requestFullscreen().then(() => {
      isFullscreen.value = true
    }).catch(() => {})
  } else {
    document.exitFullscreen().then(() => {
      isFullscreen.value = false
    }).catch(() => {})
  }
}

// Diff Slider Drag
const startDiffDrag = (e: MouseEvent | TouchEvent) => {
  e.preventDefault()
  isDraggingDiff.value = true
  window.addEventListener('mousemove', onDiffDrag)
  window.addEventListener('touchmove', onDiffDrag)
  window.addEventListener('mouseup', stopDiffDrag)
  window.addEventListener('touchend', stopDiffDrag)
}

const onDiffDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDraggingDiff.value || !playerContainerRef.value) return
  const rect = playerContainerRef.value.getBoundingClientRect()
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const pct = ((clientX - rect.left) / rect.width) * 100
  diffPosition.value = Math.max(0, Math.min(100, pct))
}

const stopDiffDrag = () => {
  isDraggingDiff.value = false
  window.removeEventListener('mousemove', onDiffDrag)
  window.removeEventListener('touchmove', onDiffDrag)
  window.removeEventListener('mouseup', stopDiffDrag)
  window.removeEventListener('touchend', stopDiffDrag)
}

onUnmounted(() => {
  stopDiffDrag()
  if (videoRef.value) {
    try {
      videoRef.value.pause()
      videoRef.value.removeAttribute('src')
      videoRef.value.load()
    } catch {}
  }
})
</script>

<style scoped>
.app-video-player {
  position: relative;
  width: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app-video-player__viewport {
  position: relative;
  width: 100%;
  min-height: 200px;
  max-height: 480px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #050505;
}

.app-video-player__video {
  width: 100%;
  height: auto;
  max-height: 480px;
  display: block;
  object-fit: contain;
  cursor: pointer;
}

.app-video-player__diff-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.app-video-player__diff-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.app-video-player__diff-slider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #fff;
  cursor: ew-resize;
  transform: translateX(-50%);
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.6);
  z-index: 10;
}

.diff-slider-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.app-video-player__diff-tag {
  position: absolute;
  top: 8px;
  padding: 2px 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  font-size: 11px;
  border-radius: 4px;
  pointer-events: none;
}
.app-video-player__diff-tag.left {
  left: 8px;
}
.app-video-player__diff-tag.right {
  right: 8px;
}

.app-video-player__controls {
  background: rgba(18, 18, 22, 0.95);
  padding: 4px 10px 8px 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.app-video-player__progressbar-wrap {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  cursor: pointer;
  margin-bottom: 6px;
  border-radius: 2px;
  position: relative;
}

.app-video-player__progressbar-fill {
  height: 100%;
  background: #18a058;
  border-radius: 2px;
  transition: width 0.1s linear;
}

.app-video-player--fullscreen {
  border-radius: 0;
}
.app-video-player--fullscreen .app-video-player__viewport {
  max-height: 100vh;
  height: 100%;
}
.app-video-player--fullscreen .app-video-player__video {
  max-height: calc(100vh - 48px);
}
</style>
