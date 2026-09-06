import type { IImportExportable } from '../../interfaces/import-export'
import type { UnifiedParameterDefinition } from '../model/parameter-schema'
import type { BaseProvider } from '../shared/types'

export type { ConnectionSchema } from '../shared/types'

// === 视频参数定义 ===

export interface VideoParameterDefinition extends UnifiedParameterDefinition {
  labelKey: string
  descriptionKey: string
  allowedValueLabelKeys?: string[]
}

// === 核心架构类型（三层分离：Provider → Model → Configuration） ===

export interface VideoProvider extends BaseProvider {}

export interface VideoModelCapabilities {
  image2video: boolean
  text2video?: boolean
  endFrame?: boolean
  cameraControl?: boolean
  motionStrength?: boolean
  supportedDurations: number[]
  supportedRatios: string[]
  supportedResolutions?: string[]
}

export interface VideoModel {
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly providerId: string
  readonly capabilities: VideoModelCapabilities
  readonly parameterDefinitions: readonly VideoParameterDefinition[]
  readonly defaultParameterValues?: Record<string, unknown>
}

export interface VideoModelConfig {
  id: string
  name: string
  providerId: string
  modelId: string
  enabled: boolean
  connectionConfig?: {
    apiKey?: string
    baseURL?: string
    [key: string]: any
  }
  paramOverrides?: Record<string, unknown>
  provider: VideoProvider
  model: VideoModel
}

export type VideoModelConfigInput = Omit<VideoModelConfig, 'provider' | 'model'> & {
  provider?: VideoProvider
  model?: VideoModel
}

// === 请求与输入类型 ===

export interface VideoInputRef {
  b64?: string
  url?: string
  assetId?: string
  mimeType?: string
}

export interface CameraMotionConfig {
  type: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'tilt_up' | 'tilt_down' | 'clockwise' | 'counter_clockwise' | 'custom'
  speed?: number
}

export interface Image2VideoRequest {
  prompt: string
  configId: string
  inputImage: VideoInputRef
  endImage?: VideoInputRef
  duration?: number
  aspectRatio?: string
  resolution?: string
  fps?: number
  motionStrength?: number
  cameraMotion?: CameraMotionConfig
  seed?: number
  paramOverrides?: Record<string, unknown>
}

export type VideoRequest = Image2VideoRequest

// === 任务状态与结果类型 ===

export type VideoTaskStatus = 'pending' | 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled'

export interface VideoResultItem {
  url?: string
  assetId?: string
  mimeType?: string
  duration?: number
  width?: number
  height?: number
  coverImageUrl?: string
  coverImageAssetId?: string
}

export interface VideoResult {
  video: VideoResultItem
  metadata?: {
    providerId: string
    modelId: string
    configId: string
    taskId: string
    generationTimeMs?: number
    usage?: Record<string, unknown>
    [key: string]: any
  }
}

export interface VideoTask {
  taskId: string
  configId: string
  status: VideoTaskStatus
  progressPercent?: number
  estimatedRemainingSeconds?: number
  createdAt: number
  updatedAt: number
  error?: {
    code: string
    message: string
    raw?: unknown
  }
  result?: VideoResult
}

export interface VideoProgressHandlers {
  onStatusChange?: (status: VideoTaskStatus, progress?: number) => void
  onPollingTick?: (task: VideoTask) => void
  onComplete?: (result: VideoResult) => void
  onError?: (error: Error) => void
}

// === 管理器接口 ===

export interface IVideoModelManager extends IImportExportable {
  ensureInitialized?(): Promise<void>
  isInitialized?(): Promise<boolean>
  addConfig(config: VideoModelConfigInput): Promise<void>
  updateConfig(id: string, updates: Partial<VideoModelConfigInput>): Promise<void>
  deleteConfig(id: string): Promise<void>
  getConfig(id: string): Promise<VideoModelConfig | null>
  getAllConfigs(): Promise<VideoModelConfig[]>
  getEnabledConfigs(): Promise<VideoModelConfig[]>
}

// === 适配器接口 ===

export interface IVideoProviderAdapter {
  getProvider(): VideoProvider
  getModels(): VideoModel[]
  getModelsAsync(connectionConfig: Record<string, any>): Promise<VideoModel[]>
  buildDefaultModel(modelId: string): VideoModel

  submitTask(request: Image2VideoRequest, config: VideoModelConfig, signal?: AbortSignal): Promise<{ taskId: string }>
  queryTask(taskId: string, config: VideoModelConfig, signal?: AbortSignal): Promise<VideoTask>
  cancelTask?(taskId: string, config: VideoModelConfig): Promise<boolean>

  generateVideo(
    request: Image2VideoRequest,
    config: VideoModelConfig,
    handlers?: VideoProgressHandlers,
    signal?: AbortSignal
  ): Promise<VideoResult>
}

// === 注册表接口 ===

export interface IVideoAdapterRegistry {
  getAdapter(providerId: string): IVideoProviderAdapter
  getAllProviders(): VideoProvider[]
  getStaticModels(providerId: string): VideoModel[]
  getDynamicModels(providerId: string, connectionConfig: Record<string, any>): Promise<VideoModel[]>
  getModels(providerId: string, connectionConfig?: Record<string, any>): Promise<VideoModel[]>
  getAllStaticModels(): Array<{ provider: VideoProvider; model: VideoModel }>
  supportsDynamicModels(providerId: string): boolean
  validateProviderModel(providerId: string, modelId: string): boolean
}

// === 服务接口 ===

export interface IVideoService {
  validateRequest(request: Image2VideoRequest): Promise<void>
  generateVideo(
    request: Image2VideoRequest,
    handlers?: VideoProgressHandlers,
    signal?: AbortSignal
  ): Promise<VideoResult>
  submitTask(request: Image2VideoRequest): Promise<{ taskId: string }>
  queryTask(configId: string, taskId: string): Promise<VideoTask>
  cancelTask(configId: string, taskId: string): Promise<boolean>
  testConnection(config: VideoModelConfig): Promise<boolean>
}

// === 视频存储模型定义 ===

export interface VideoMetadata {
  id: string
  duration?: number
  width?: number
  height?: number
  mimeType: string
  sizeBytes: number
  coverAssetId?: string
  remoteUrl?: string
  createdAt: number
  accessedAt: number
  source: 'generated' | 'uploaded'
  metadata?: {
    prompt?: string
    modelId?: string
    configId?: string
    taskId?: string
  }
}

export interface VideoRef {
  id: string
  _type: 'video-ref'
  url?: never
  mimeType?: never
}

export interface FullVideoData {
  metadata: VideoMetadata
  blob?: Blob
  dataUrl?: string
}

export interface VideoStorageConfig {
  maxCacheSize?: number
  maxAge?: number
  maxCount?: number
  autoCleanupThreshold?: number
  dbName?: string
  quotaStrategy?: 'evict' | 'reject'
}

export interface IVideoStorageService {
  saveVideo(data: FullVideoData): Promise<string>
  getVideo(id: string): Promise<FullVideoData | null>
  getMetadata(id: string): Promise<VideoMetadata | null>
  deleteVideo(id: string): Promise<void>
  deleteVideos(ids: string[]): Promise<void>
  clearAll(): Promise<void>
  cleanupOldVideos(): Promise<number>
  enforceQuota(): Promise<void>
  listAllMetadata(): Promise<VideoMetadata[]>
  getStorageStats(): Promise<{
    count: number
    totalBytes: number
    oldestAt: number | null
    newestAt: number | null
  }>
  getConfig(): VideoStorageConfig
  updateConfig(config: Partial<VideoStorageConfig>): Promise<void>
  close(): Promise<void>
}

export function isVideoRef(item: unknown): item is VideoRef {
  return typeof item === 'object' && item !== null && (item as any)._type === 'video-ref'
}

export function createVideoRef(id: string): VideoRef {
  return { id, _type: 'video-ref' }
}
