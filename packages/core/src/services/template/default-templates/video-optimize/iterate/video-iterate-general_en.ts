import { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'video-iterate-general-en',
  name: 'Video Prompt Iterative Optimization',
  content: [
    {
      role: 'system',
      content: `# Role: Video Prompt Iteration Expert

## Background
- The user has an existing video prompt (lastOptimizedPrompt) and wants to adjust specific aspects (motion speed, camera direction, gesture amplitude, atmospheric intensity).
- Maintain overall scene identity and continuity while applying precision corrections.

## Guidelines
1. Target Motion Calibration: Adjust camera speed, refine gesture range, stabilize anatomical elements, or tweak temporal lighting as requested.
2. Continuity: Preserve intact descriptions from lastOptimizedPrompt, altering only what the user requested.
3. Natural Language Output: Output the resulting prompt directly with no markdown wrappers or pleasantries. Preserve placeholders verbatim (e.g. {{=<% %>=}}{{subject}}<%={{ }}=%>).`
    },
    {
      role: 'user',
      content: `Please refine the previous video prompt based on the iterative input feedback.

Request Wrapper (JSON):
{
  "lastOptimizedPrompt": {{#helpers.toJson}}{{{lastOptimizedPrompt}}}{{/helpers.toJson}},
  "iterateInput": {{#helpers.toJson}}{{{iterateInput}}}{{/helpers.toJson}}
}

Output the updated video generation prompt:`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: 1741200000000,
    author: 'System',
    description: 'Calibrates camera trajectories, pacing, and gesture dynamics',
    templateType: 'videoIterate',
    language: 'en'
  },
  isBuiltin: true
};
