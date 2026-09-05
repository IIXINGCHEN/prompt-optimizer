import {
  IVideoAdapterRegistry,
  IVideoProviderAdapter,
  VideoProvider,
  VideoModel,
} from '../types'
import { AbstractAdapterRegistry } from '../../adapters/abstract-registry'
import { VideoError } from '../errors'
import { VIDEO_ERROR_CODES } from '../../../constants/error-codes'
import { DashScopeVideoAdapter } from './dashscope'
import { SiliconFlowVideoAdapter } from './siliconflow'

export class VideoAdapterRegistry
  extends AbstractAdapterRegistry<
    IVideoProviderAdapter,
    VideoProvider,
    VideoModel,
    Record<string, unknown>
  >
  implements IVideoAdapterRegistry
{
  protected createUnknownProviderError(providerId: string): Error {
    return new VideoError(VIDEO_ERROR_CODES.PROVIDER_NOT_FOUND, undefined, { providerId })
  }

  protected initializeAdapters(): void {
    const dashscopeAdapter = new DashScopeVideoAdapter()
    const siliconflowAdapter = new SiliconFlowVideoAdapter()

    this.adapters.set('dashscope', dashscopeAdapter)
    this.adapters.set('siliconflow', siliconflowAdapter)

    this.preloadStaticModels()
  }

  protected getProviderFromAdapter(adapter: IVideoProviderAdapter): VideoProvider {
    return adapter.getProvider()
  }

  protected getModelsFromAdapter(adapter: IVideoProviderAdapter): VideoModel[] {
    return adapter.getModels()
  }

  protected async getModelsAsyncFromAdapter(
    adapter: IVideoProviderAdapter,
    connectionConfig: Record<string, unknown>
  ): Promise<VideoModel[]> {
    return await adapter.getModelsAsync(connectionConfig)
  }

  protected getProviderTypeDescription(): string {
    return 'video provider'
  }
}

export const createVideoAdapterRegistry = (): IVideoAdapterRegistry => new VideoAdapterRegistry()
