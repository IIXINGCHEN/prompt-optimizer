<template>
  <div class="video-model-list">
    <NEmpty v-if="configs.length === 0" :description="t('video.model.empty')">
      <template #extra>
        <NButton type="primary" @click="openAddModal">{{ t('video.model.addFirst') }}</NButton>
      </template>
    </NEmpty>

    <NSpace v-else vertical :size="12" class="video-model-stack">
      <NCard
        v-for="config in configs"
        :key="config.id"
        size="small"
        hoverable
        class="video-model-card"
        :style="{ opacity: config.enabled ? 1 : 0.6 }"
      >
        <template #header>
          <NSpace justify="space-between" align="center">
            <NSpace vertical :size="4">
              <NSpace align="center" :size="8">
                <NText strong>{{ config.name || config.id }}</NText>
                <NTag
                  v-if="!config.enabled"
                  type="warning"
                  size="small"
                  round
                  :bordered="false"
                >
                  {{ t('modelManager.disabled') }}
                </NTag>
              </NSpace>
              <NSpace :size="6">
                <NTag size="small" type="default" round :bordered="false">
                  {{ config.provider?.name || config.providerId }}
                </NTag>
                <NTag size="small" type="info" round :bordered="false">
                  {{ config.model?.name || config.modelId }}
                </NTag>
                <NTag size="small" type="success" round :bordered="false">
                  {{ t('video.capability.image2video') }}
                </NTag>
                <NTag
                  v-if="config.model?.capabilities?.endFrame"
                  size="small"
                  type="primary"
                  round
                  :bordered="false"
                >
                  {{ t('video.capability.endFrame') }}
                </NTag>
              </NSpace>
            </NSpace>
          </NSpace>
        </template>

        <template #header-extra>
          <NSpace @click.stop :size="4">
            <NButton
              @click="handleTestConnection(config)"
              size="small"
              quaternary
              :disabled="isTesting"
              :loading="isTesting"
            >
              {{ t('modelManager.testConnection') }}
            </NButton>
            <NSwitch
              :value="config.enabled"
              size="small"
              @update:value="(val) => toggleConfigEnabled(config.id, val)"
            />
            <NButton size="small" quaternary @click="openEditModal(config)">
              {{ t('common.edit') }}
            </NButton>
            <NPopconfirm @positive-click="deleteConfig(config.id)">
              <template #trigger>
                <NButton size="small" quaternary type="error">
                  {{ t('common.delete') }}
                </NButton>
              </template>
              {{ t('common.confirmDelete') }}
            </NPopconfirm>
          </NSpace>
        </template>
      </NCard>
    </NSpace>

    <VideoModelEditModal
      v-model:show="showEditModal"
      :config="editingConfig"
      @saved="handleConfigSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NEmpty,
  NButton,
  NSpace,
  NCard,
  NText,
  NTag,
  NSwitch,
  NPopconfirm,
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { VideoModelConfig } from '@prompt-optimizer/core'
import { useVideoModelManager } from '../composables/model/useVideoModelManager'
import VideoModelEditModal from './VideoModelEditModal.vue'

const { t } = useI18n()
const {
  configs,
  loadConfigs,
  testConnection,
  deleteConfig,
  toggleConfigEnabled,
} = useVideoModelManager()

const showEditModal = ref(false)
const editingConfig = ref<VideoModelConfig | null>(null)
const isTesting = ref(false)

const openAddModal = () => {
  editingConfig.value = null
  showEditModal.value = true
}

const openEditModal = (config: VideoModelConfig) => {
  editingConfig.value = config
  showEditModal.value = true
}

const handleTestConnection = async (config: VideoModelConfig) => {
  isTesting.value = true
  try {
    await testConnection(config)
  } finally {
    isTesting.value = false
  }
}

const handleConfigSaved = async () => {
  showEditModal.value = false
  await loadConfigs()
}

onMounted(async () => {
  await loadConfigs()
})

defineExpose({
  openAddModal,
})
</script>

<style scoped>
.video-model-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.video-model-stack {
  overflow-y: auto;
}
.video-model-card {
  border-radius: 8px;
}
</style>
