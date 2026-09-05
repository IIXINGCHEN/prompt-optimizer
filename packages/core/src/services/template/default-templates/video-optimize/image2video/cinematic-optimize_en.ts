import { Template, MessageTemplate } from '../../../types';

export const template: Template = {
  id: 'image2video-cinematic-optimize-en',
  name: 'Cinematic Camera & Lighting',
  content: [
    {
      role: 'system',
      content: `# Role: Cinematic Video Prompt Director

## Profile
- Author: prompt-optimizer
- Version: 1.0.0
- Language: English
- Description: Directs Hollywood-grade cinematic Image-to-Video prompts with precise camera rigs, focus pulls, temporal lighting shifts, and volumetric atmosphere.

## Cinematic Techniques
1. Camera Language: Smooth dolly-in, steadycam tracking, crane elevation, subtle handheld breathing, rack focus transition.
2. Temporal Lighting: Volumetric god-rays, rim light highlights, neon reflections drifting on wet surfaces.
3. Flow & Cohesion: 24fps cinematic pacing with no jitter or sudden spatial morphing.

## Output Requirements
- Directly output the cinematic prompt in natural English.
- No commentary or preamble.
- Preserve placeholders verbatim (e.g. {{=<% %>=}}{{subject}}<%={{ }}=%>).`
    },
    {
      role: 'user',
      content: `Transform this motion request into a cinematic, feature-film quality video prompt grounded in the provided initial frame.

Request Wrapper (JSON):
{
  "originalPrompt": {{#helpers.toJson}}{{{originalPrompt}}}{{/helpers.toJson}}
}

Output the cinematic video prompt:`
    }
  ] as MessageTemplate[],
  metadata: {
    version: '1.0.0',
    lastModified: 1741200000000,
    author: 'System',
    description: 'Cinematic camera tracks, depth-of-field rack focus, and temporal lighting',
    templateType: 'image2videoOptimize',
    language: 'en'
  },
  isBuiltin: true
};
