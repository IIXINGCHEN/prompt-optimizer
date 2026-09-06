import type { TextModelConfig } from '../model/types'
import type { IImageUnderstandingService } from '../image-understanding/types'
import { ImageUnderstandingService } from '../image-understanding/service'
import { VideoError } from './errors'
import { VIDEO_ERROR_CODES } from '../../constants/error-codes'

export interface ExtractVisualGroundingParams {
  modelConfig: TextModelConfig
  imageB64: string
  mimeType?: string
  dynamicIntent?: string
  imageUnderstandingService?: IImageUnderstandingService
}

const VISUAL_GROUNDING_SYSTEM_PROMPT = `# Role: 电影级图生视频首帧视觉锚定分析师 (Visual Grounding Analyst)

## 任务目标
深度解析用户上传的图生视频“首帧参考图”，为下游纯文本提示词模型提供权威、精确、客观的视觉事实基准，使其能够基于画面空间与生理物理结构推演出真实自然的电影镜头与动作轨迹。

## 解析核心要素
1. 主体身份与静止姿态：
   - 准确提取人物性别、年龄感、体型、发型发色、服装款式与面料材质、配饰，以及当前的初始静止姿态与重心位置；
   - 若主体为物品/车辆/建筑：提取准确的几何比例、材质质感（金属拉丝/透明玻璃/哑光皮革）与空间朝向。
2. 摄影构图与空间透视：
   - 景别（特写/中景/全景）、拍摄高度角度（平视/俯拍/微仰视角）、景深状态（浅景深虚化/全景深）。
   - 前景、中景、背景的层次关系与纵深感。
3. 环境物理与光影色调：
   - 光源主方向（顺光/侧光/侧逆光/轮廓光）、光质硬软、整体主色调与环境氛围。
   - 画面中具有自然运动潜力的物理元素（如空气微风拂发、衣角摆动、水面微澜、流光反光）。
4. 初始运动线索：
   - 标明主体基于当前姿势最合乎力学的初始动作启动方向。

## 输出规范
- 纯文本 Markdown 输出精炼、详实的分析，控制在 3-5 个段落，客观如实，严禁臆造原图中不存在的内容。
- 严禁输出 Markdown 代码块包裹或无关问候。`

export async function extractVisualGrounding(
  params: ExtractVisualGroundingParams
): Promise<string> {
  const { modelConfig, imageB64, mimeType = 'image/png', dynamicIntent = '', imageUnderstandingService } = params

  if (!modelConfig) {
    throw new VideoError(VIDEO_ERROR_CODES.CONFIG_NOT_FOUND, 'Vision model config is required for visual grounding')
  }
  if (!imageB64?.trim()) {
    throw new VideoError(VIDEO_ERROR_CODES.INPUT_IMAGE_B64_REQUIRED, 'Valid image base64 is required for visual grounding')
  }

  const service = imageUnderstandingService || new ImageUnderstandingService()

  const rawB64 = imageB64.includes(',') ? imageB64.split(',')[1] : imageB64

  const userPrompt = dynamicIntent.trim()
    ? `请详细解析当前首帧图片的视觉锚定特征，并结合用户的预期动态意图「${dynamicIntent.trim()}」，提取用于图生视频动作推演的结构化视觉事实。`
    : `请全面且精炼地解析当前首帧图片的视觉特征、主体静态姿态、构图机位与光影环境，作为图生视频自主镜头推演的基准事实。`

  const response = await service.understand({
    modelConfig,
    systemPrompt: VISUAL_GROUNDING_SYSTEM_PROMPT,
    userPrompt,
    images: [
      {
        b64: rawB64,
        mimeType,
      },
    ],
    paramOverrides: {
      temperature: 0.2,
    },
  })

  const content = typeof response.content === 'string' ? response.content.trim() : ''
  if (!content) {
    throw new VideoError(VIDEO_ERROR_CODES.GENERATION_FAILED, 'Vision model returned empty visual grounding text')
  }

  return content
}
