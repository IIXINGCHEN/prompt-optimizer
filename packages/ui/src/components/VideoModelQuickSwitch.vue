<template>
  <div v-if="selectedConfig" class="video-model-quick-switch" data-testid="video-model-quick-switch">
    <NTag
      size="small"
      :bordered="false"
      class="video-model-quick-switch__model"
      :title="fullModelTitle"
    >
      {{ modelLabel }}
    </NTag>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NTag } from 'naive-ui'
import type { VideoModelConfig } from '@prompt-optimizer/core'
import type { SelectOption } from '../types/select-options'

interface Props {
  modelKey: string
  options: SelectOption<VideoModelConfig>[]
  disabled?: boolean
  refreshModels?: () => Promise<void> | void
}

const props = withDefaults(defineProps<Props>(), {
  options: () => [],
  disabled: false,
  refreshModels: undefined,
})

const selectedConfig = computed(() =>
  props.options.find((option) => option.value === props.modelKey)?.raw ?? null
)

const providerLabel = computed(() =>
  selectedConfig.value?.provider?.name || selectedConfig.value?.providerId || ''
)
const modelLabel = computed(() =>
  selectedConfig.value?.model?.name || selectedConfig.value?.modelId || ''
)
const fullModelTitle = computed(() =>
  providerLabel.value ? `${providerLabel.value} / ${modelLabel.value}` : modelLabel.value
)
</script>

<style scoped>
.video-model-quick-switch {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  vertical-align: middle;
}
.video-model-quick-switch__model {
  max-width: min(180px, 100%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
