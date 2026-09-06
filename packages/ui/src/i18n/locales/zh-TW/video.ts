const messages = {
  "videoMode": {
    "image2video": "圖生影片",
    "image2videoDescription": "基於首幀影像與動態提示詞生成影片"
  },
  "videoWorkspace": {
    "input": {
      "template": "優化範本",
      "templatePlaceholder": "請選擇圖生影片優化範本",
      "originalPrompt": "動態意圖與提示詞",
      "originalPromptPlaceholder": "請輸入對影片運鏡、主體動作、時序節奏的動態描述",
      "firstFrameImage": "首幀輸入影像",
      "selectFirstFrame": "選擇首幀",
      "promptRequired": "請輸入生成提示詞"
    }
  },
  "video": {
    "model": {
      "empty": "暫無已配置的影片模型",
      "addFirst": "新增第一個影片模型",
      "addTitle": "新增影片模型",
      "editTitle": "編輯影片模型",
      "namePlaceholder": "為模型設定易識別的名稱"
    },
    "capability": {
      "image2video": "圖生影片",
      "endFrame": "首尾幀"
    },
    "config": {
      "providerSection": "提供商配置",
      "provider": "影片提供商",
      "selectProvider": "選擇影片生成服務提供商",
      "modelSection": "模型配置",
      "model": "影片模型",
      "selectModel": "選擇或輸入模型名稱",
      "addSuccess": "新增影片模型成功",
      "updateSuccess": "更新影片模型成功",
      "deleteSuccess": "刪除影片模型成功",
      "notEnabledWarning": "影片模型「{name}」尚未設定 API Key 或未啟用，已為您開啟影片模型設定。",
      "notConfiguredTag": "需設定API Key",
      "dashscopeBaseUrlHint": "預設留空即可（自動使用百煉官方原生端點 https://dashscope.aliyuncs.com/api/v1）。請勿填寫文字模型的 compatible-mode/v1 位址。"
    },
    "connection": {
      "testing": "正在測試連線...",
      "testSuccess": "連線測試成功",
      "testFailed": "連線測試失敗"
    },
    "task": {
      "queued": "排隊等待中...",
      "generating": "影片生成中...",
      "succeeded": "影片生成成功",
      "failed": "影片生成失敗"
    },
    "player": {
      "play": "播放",
      "pause": "暫停",
      "prevFrame": "上一幀 (-0.04s)",
      "nextFrame": "下一幀 (+0.04s)",
      "loop": "循環",
      "loopTooltip": "切換自動循環播放",
      "diffButton": "首幀對比",
      "diffTooltip": "左右滑動對比原圖與影片首幀",
      "originalImage": "原始首幀",
      "generatedVideo": "生成影片",
      "download": "下載影片",
      "fullscreen": "全螢幕"
    },
    "metadata": {
      "model": "模型"
    }
  }
} as const;

export default messages;
