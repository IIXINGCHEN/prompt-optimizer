import Dexie, { Table } from 'dexie'
import type {
  FullVideoData,
  VideoMetadata,
  IVideoStorageService,
  VideoStorageConfig,
} from './types'

class VideoDB extends Dexie {
  videoMetadata!: Table<MetadataRecord, string>
  videoData!: Table<DataRecord, string>

  constructor(dbName: string) {
    super(dbName)
    this.version(1).stores({
      videoMetadata: 'id, createdAt, accessedAt, sizeBytes, source',
      videoData: 'id',
    })
  }
}

interface MetadataRecord {
  id: string
  metadata: string // JSON-serialized VideoMetadata
  createdAt: number
  accessedAt: number
  sizeBytes: number
  source: 'generated' | 'uploaded'
}

interface DataRecord {
  id: string
  blob?: Blob
  dataUrl?: string
}

const DEFAULT_CONFIG: VideoStorageConfig = {
  maxCacheSize: 200 * 1024 * 1024, // 200 MB
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxCount: 50, // up to 50 videos
  autoCleanupThreshold: 0.8,
  dbName: 'PromptOptimizerVideoDB',
  quotaStrategy: 'evict',
}

export class VideoStorageService implements IVideoStorageService {
  private readonly db: VideoDB
  private config: VideoStorageConfig

  constructor(config?: Partial<VideoStorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.db = new VideoDB(this.config.dbName || DEFAULT_CONFIG.dbName || 'PromptOptimizerVideoDB')
  }

  async saveVideo(data: FullVideoData): Promise<string> {
    const now = Date.now()

    await this.assertQuotaForSave(data)

    const metadataRecord: MetadataRecord = {
      id: data.metadata.id,
      metadata: JSON.stringify(data.metadata),
      createdAt: data.metadata.createdAt,
      accessedAt: now,
      sizeBytes: data.metadata.sizeBytes,
      source: data.metadata.source,
    }

    const dataRecord: DataRecord = {
      id: data.metadata.id,
      blob: data.blob,
      dataUrl: data.dataUrl,
    }

    await this.db.transaction('rw', this.db.videoMetadata, this.db.videoData, async () => {
      await this.db.videoMetadata.put(metadataRecord)
      await this.db.videoData.put(dataRecord)
    })

    await this.autoCleanupIfNeeded()

    return data.metadata.id
  }

  async getVideo(id: string): Promise<FullVideoData | null> {
    const [metadataRecord, dataRecord] = await Promise.all([
      this.db.videoMetadata.get(id),
      this.db.videoData.get(id),
    ])

    if (!metadataRecord) {
      return null
    }

    await this.db.videoMetadata.update(id, { accessedAt: Date.now() })

    return {
      metadata: JSON.parse(metadataRecord.metadata) as VideoMetadata,
      blob: dataRecord?.blob,
      dataUrl: dataRecord?.dataUrl,
    }
  }

  async getMetadata(id: string): Promise<VideoMetadata | null> {
    const record = await this.db.videoMetadata.get(id)
    if (!record) return null
    return JSON.parse(record.metadata) as VideoMetadata
  }

  async deleteVideo(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.videoMetadata, this.db.videoData, async () => {
      await this.db.videoMetadata.delete(id)
      await this.db.videoData.delete(id)
    })
  }

  async deleteVideos(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.db.transaction('rw', this.db.videoMetadata, this.db.videoData, async () => {
      await this.db.videoMetadata.bulkDelete(ids)
      await this.db.videoData.bulkDelete(ids)
    })
  }

  async clearAll(): Promise<void> {
    await this.db.transaction('rw', this.db.videoMetadata, this.db.videoData, async () => {
      await this.db.videoMetadata.clear()
      await this.db.videoData.clear()
    })
  }

  async cleanupOldVideos(): Promise<number> {
    if (!this.config.maxAge) return 0
    const cutoff = Date.now() - this.config.maxAge
    const expired = await this.db.videoMetadata.where('accessedAt').below(cutoff).toArray()
    if (expired.length === 0) return 0

    const ids = expired.map((e) => e.id)
    await this.deleteVideos(ids)
    return ids.length
  }

  async enforceQuota(): Promise<void> {
    const records = await this.db.videoMetadata.orderBy('accessedAt').toArray()
    let currentBytes = records.reduce((sum, r) => sum + r.sizeBytes, 0)
    let currentCount = records.length

    const maxBytes = this.config.maxCacheSize ?? Infinity
    const maxCount = this.config.maxCount ?? Infinity

    const toDelete: string[] = []

    for (const record of records) {
      if (currentBytes <= maxBytes && currentCount <= maxCount) break
      toDelete.push(record.id)
      currentBytes -= record.sizeBytes
      currentCount -= 1
    }

    if (toDelete.length > 0) {
      await this.deleteVideos(toDelete)
    }
  }

  async listAllMetadata(): Promise<VideoMetadata[]> {
    const records = await this.db.videoMetadata.toArray()
    return records.map((r) => JSON.parse(r.metadata) as VideoMetadata)
  }

  async getStorageStats(): Promise<{
    count: number
    totalBytes: number
    oldestAt: number | null
    newestAt: number | null
  }> {
    const records = await this.db.videoMetadata.toArray()
    if (records.length === 0) {
      return { count: 0, totalBytes: 0, oldestAt: null, newestAt: null }
    }

    let totalBytes = 0
    let oldestAt = Infinity
    let newestAt = -Infinity

    for (const r of records) {
      totalBytes += r.sizeBytes
      if (r.createdAt < oldestAt) oldestAt = r.createdAt
      if (r.createdAt > newestAt) newestAt = r.createdAt
    }

    return {
      count: records.length,
      totalBytes,
      oldestAt: oldestAt === Infinity ? null : oldestAt,
      newestAt: newestAt === -Infinity ? null : newestAt,
    }
  }

  getConfig(): VideoStorageConfig {
    return { ...this.config }
  }

  async updateConfig(config: Partial<VideoStorageConfig>): Promise<void> {
    this.config = { ...this.config, ...config }
  }

  async close(): Promise<void> {
    this.db.close()
  }

  private async assertQuotaForSave(data: FullVideoData): Promise<void> {
    if (this.config.quotaStrategy !== 'reject') return
    const maxBytes = this.config.maxCacheSize ?? Infinity
    const maxCount = this.config.maxCount ?? Infinity

    const stats = await this.getStorageStats()
    if (stats.count + 1 > maxCount || stats.totalBytes + data.metadata.sizeBytes > maxBytes) {
      throw new Error('Video storage quota exceeded')
    }
  }

  private async autoCleanupIfNeeded(): Promise<void> {
    const threshold = this.config.autoCleanupThreshold ?? 0.8
    const maxBytes = this.config.maxCacheSize ?? Infinity
    const maxCount = this.config.maxCount ?? Infinity

    const stats = await this.getStorageStats()
    if (stats.totalBytes >= maxBytes * threshold || stats.count >= maxCount * threshold) {
      await this.enforceQuota()
    }
  }
}

export function createVideoStorageService(
  config?: Partial<VideoStorageConfig>
): IVideoStorageService {
  return new VideoStorageService(config)
}
