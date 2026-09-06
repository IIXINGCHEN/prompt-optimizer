const messages = {
  "videoMode": {
    "image2video": "图生视频",
    "image2videoDescription": "基于首帧图像与动态提示词生成视频"
  },
  "videoWorkspace": {
    "input": {
      "template": "优化模板",
      "templatePlaceholder": "请选择图生视频优化模板",
      "originalPrompt": "动态意图与提示词",
      "originalPromptPlaceholder": "请输入对视频运镜、主体动作、时序节奏的动态描述",
      "firstFrameImage": "首帧输入图像",
      "selectFirstFrame": "选择首帧",
      "promptRequired": "请输入生成提示词"
    }
  },
  "video": {
    "model": {
      "empty": "暂无已配置的视频模型",
      "addFirst": "添加第一个视频模型",
      "addTitle": "添加视频模型",
      "editTitle": "编辑视频模型",
      "namePlaceholder": "为模型起一个容易识别的名称"
    },
    "capability": {
      "image2video": "图生视频",
      "endFrame": "首尾帧"
    },
    "config": {
      "providerSection": "提供商配置",
      "provider": "视频提供商",
      "selectProvider": "选择视频生成服务提供商",
      "modelSection": "模型配置",
      "model": "视频模型",
      "selectModel": "选择或输入模型名称",
      "addSuccess": "添加视频模型成功",
      "updateSuccess": "更新视频模型成功",
      "deleteSuccess": "删除视频模型成功",
      "notEnabledWarning": "视频模型「{name}」尚未配置 API Key 或未启用，已为您打开视频模型配置。",
      "notConfiguredTag": "需配置API Key",
      "dashscopeBaseUrlHint": "默认留空即可（自动使用百炼官方原生端点 https://dashscope.aliyuncs.com/api/v1）。请勿填写文本模型的 compatible-mode/v1 地址。"
    },
    "connection": {
      "testing": "正在测试连接...",
      "testSuccess": "连接测试成功",
      "testFailed": "连接测试失败"
    },
    "task": {
      "queued": "排队等待中...",
      "generating": "视频生成中...",
      "succeeded": "视频生成成功",
      "failed": "视频生成失败"
    },
    "player": {
      "play": "播放",
      "pause": "暂停",
      "prevFrame": "上一帧 (-0.04s)",
      "nextFrame": "下一帧 (+0.04s)",
      "loop": "循环",
      "loopTooltip": "切换自动循环播放",
      "diffButton": "首帧对比",
      "diffTooltip": "左右滑动对比原图与视频首帧",
      "originalImage": "原始首帧",
      "generatedVideo": "生成视频",
      "download": "下载视频",
      "fullscreen": "全屏"
    },
    "metadata": {
      "model": "模型"
    }
  }
} as const;

export default messages;
