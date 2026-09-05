<template>
  <NButtonGroup>
    <NButton
      data-testid="video-sub-mode-image2video"
      :type="modelValue === 'image2video' ? 'primary' : 'default'"
      size="small"
      @click="handleModeChange('image2video')"
      :disabled="disabled"
    >
      {{ t('videoMode.image2video') }}
    </NButton>
  </NButtonGroup>
</template>

<script setup lang="ts">
import { NButtonGroup, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

export type VideoMode = 'image2video'

interface Props {
  modelValue: VideoMode
  disabled?: boolean
  allowReselect?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: VideoMode): void
  (e: 'change', value: VideoMode): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  allowReselect: false,
})

const emit = defineEmits<Emits>()
const { t } = useI18n()

const handleModeChange = (mode: VideoMode) => {
  if (props.disabled) return
  if (props.modelValue === mode && !props.allowReselect) return

  emit('update:modelValue', mode)
  emit('change', mode)
}
</script>
