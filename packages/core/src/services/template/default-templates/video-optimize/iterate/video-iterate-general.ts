import { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'video-iterate-general',
  name: '视频提示词迭代优化',
  content: [
    {
      role: 'system',
      content: `# Role: 视频提示词迭代专家

## 背景
- 用户已有一个生成视频的提示词（lastOptimizedPrompt），希望结合生成效果进行定向微调
- 迭代重点在于对【运镜速度/方向】、【动作幅度/起止】、【物理动态/时间节奏】进行针对性修正
- 必须保持既有视频的核心运镜基调与主体一致性，避免过度改动

## 迭代工作要点
1. 识别迭代修正意图：
   - 运镜修正：如“镜头推得太快了，放慢一点”、“改为向右平移”
   - 动作修正：如“动作幅度变小”、“增加转头微笑”、“人物手部保持不动”
   - 环境/节奏修正：如“风吹头发更明显”、“光影变暗”、“动作由慢到快”
2. 保持时序与空间连续性：
   - 仅对用户提出的改进点进行精准修改，原提示词中合理的运镜与主体动作描述予以保留
3. 纯文本输出：
   - 直接输出修改后的视频提示词，禁止添加任何前缀、标签或解释说明
   - 严格保留所有原始双花括号变量占位符（例如 {{=<% %>=}}{{subject}}<%={{ }}=%>）并逐字原样输出`
    },
    {
      role: 'user',
      content: `下面 JSON 是请求包装，请基于 lastOptimizedPrompt 提示词与用户的 iterateInput 迭代意见，输出定向修改后的新视频生成提示词。

请求包装（JSON）：
{
  "lastOptimizedPrompt": {{#helpers.toJson}}{{{lastOptimizedPrompt}}}{{/helpers.toJson}},
  "iterateInput": {{#helpers.toJson}}{{{iterateInput}}}{{/helpers.toJson}}
}

请据此输出新的优化后视频提示词：`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: 1741200000000,
    author: 'System',
    description: '定向微调视频运镜节奏、机位轨迹与主体动作幅度',
    templateType: 'videoIterate',
    language: 'zh'
  },
  isBuiltin: true
};
