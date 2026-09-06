const messages = {
  "videoMode": {
    "image2video": "Image to Video",
    "image2videoDescription": "Generate video from initial frame and motion prompt"
  },
  "videoWorkspace": {
    "input": {
      "template": "Optimize Template",
      "templatePlaceholder": "Select an image-to-video optimize template",
      "originalPrompt": "Motion Intent & Prompt",
      "originalPromptPlaceholder": "Describe camera trajectories, subject actions, and temporal pacing",
      "firstFrameImage": "First Frame Image",
      "selectFirstFrame": "Select First Frame",
      "promptRequired": "Please enter a generation prompt",
      "autonomousDeduce": "Autonomous Camera Deduction",
      "autonomousDeduceRecordTag": "[Autonomous Scene Deduction]",
      "engineDialect": "Target Engine Dialect",
      "dialectAuto": "Auto-sync with test model",
      "dialectGeneral": "Universal Hollywood Cinematography",
      "dialectWanx": "WanX (Strict first-frame non-redundancy)",
      "dialectKling": "Kling (Motion brush & coherence)",
      "dialectRunway": "Runway Gen-3 (Cinematic camera glide)",
      "dialectHailuo": "Hailuo (Physical dynamic fidelity)",
      "dialectCogVideo": "CogVideoX (Spatial-temporal dynamics)"
    },
    "optimizingPhase": {
      "grounding": "👁️ Analyzing visual grounding...",
      "synthesizing": "⚡ Synthesizing video prompt..."
    }
  },
  "video": {
    "model": {
      "empty": "No configured video models",
      "addFirst": "Add first video model",
      "addTitle": "Add Video Model",
      "editTitle": "Edit Video Model",
      "namePlaceholder": "Enter an identifiable model name"
    },
    "capability": {
      "image2video": "Image to Video",
      "endFrame": "First/Last Frame"
    },
    "config": {
      "providerSection": "Provider Configuration",
      "provider": "Video Provider",
      "selectProvider": "Select video service provider",
      "modelSection": "Model Configuration",
      "model": "Video Model",
      "selectModel": "Select or enter model name",
      "addSuccess": "Video model added successfully",
      "updateSuccess": "Video model updated successfully",
      "deleteSuccess": "Video model deleted successfully",
      "notEnabledWarning": "Video model \"{name}\" is not enabled or lacks an API Key. Opening Video Model Manager...",
      "notConfiguredTag": "Needs API Key",
      "dashscopeBaseUrlHint": "Leave empty by default (auto-uses official https://dashscope.aliyuncs.com/api/v1). Do not use text model compatible-mode/v1 endpoints."
    },
    "connection": {
      "testing": "Testing connection...",
      "testSuccess": "Connection test succeeded",
      "testFailed": "Connection test failed"
    },
    "task": {
      "queued": "Queued...",
      "generating": "Generating video...",
      "succeeded": "Video generated successfully",
      "failed": "Video generation failed"
    },
    "player": {
      "play": "Play",
      "pause": "Pause",
      "prevFrame": "Prev frame (-0.04s)",
      "nextFrame": "Next frame (+0.04s)",
      "loop": "Loop",
      "loopTooltip": "Toggle automatic loop playback",
      "diffButton": "Diff",
      "diffTooltip": "Slide to compare original image against video initial frame",
      "originalImage": "Initial Frame",
      "generatedVideo": "Generated Video",
      "download": "Download Video",
      "fullscreen": "Fullscreen"
    },
    "metadata": {
      "model": "Model"
    }
  }
} as const;

export default messages;
