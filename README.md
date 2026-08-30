# 微量生活 · AI 私人健康管家

> 字节跳动 Trae AI 创作力大赛参赛作品
>
> 一款基于大模型的移动端健康管理应用，覆盖营养膳食分析、AI 心理疏导、睡眠辅助、健康顾问四大核心场景，让健康管理变得轻盈、温暖、可持续。

---

## 功能特性

### 营养膳食分析
- **AI 智能解析**：输入"一碗西红柿牛肉面"等模糊描述，大模型自动拆解食材并估算克数
- **拍照识别**：拍摄食物照片，AI 自动识别并解析营养成分
- **本地知识库匹配**：30 项预置中式食材库，按重量精准计算蛋白质/脂肪/碳水/热量
- **手动添加 + AI 入口**：手动记录界面内可直接调用 AI 识别，结果合并到已选食物
- **兜底容错**：AI 识别失败时自动降级为手动输入模式

### 睡眠辅助系统
- **AI 睡眠小贴士**：结合睡眠评分 + 当日饮食数据，流式生成专属助眠建议
- **白噪音混音台**：Web Audio API 程序化生成白/粉/棕噪音 + 雨声/海浪/森林/篝火，6 音轨独立音量、定时关闭
- **呼吸引导**：CSS3 呼吸球动画，支持 4-7-8 助眠法、箱式呼吸法、快速放松法
- **睡眠记录与趋势**：每日评分记录 + 7 日 ECharts 趋势图 + AI 睡眠周报

### AI 心理疏导
- **共情式流式对话**：基于 CBT（认知行为疗法）原则的系统提示，打字机效果
- **三种对话风格**：温暖的朋友 / 专业心理咨询师 / 正念导师
- **危机干预**：自杀/自残关键词检测，触发热线预警弹窗
- **情绪日记**：8 种情绪记录 + 强度评分 + 7/30 日趋势图
- **首次免责声明**：明确 AI 边界，保护用户权益

### 基础功能模块
- **健康看板**：今日营养概览 + 六维健康雷达图（动态计算）+ 快捷打卡 + AI 每日寄语 + 实时天气
- **AI 健康顾问**：多轮上下文对话 + 用户画像注入 System Prompt + 10 项快捷问题
- **首启建档**：3 步完成身体档案设置（性别/身高体重/健康目标）+ 功能引导教程
- **个人中心**：BMI 卡片 + 身体档案编辑 + 目标设定编辑 + 数据管理
- **新手教程**：功能级交互式引导，强制完成才能继续操作

### Android APK
- **一键打包**：`npm run apk:release` 自动完成 Web 构建 → Capacitor 同步 → Gradle 签名打包
- **Release 签名**：已配置 keystore 自动签名，APK Signature Scheme v2

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 构建工具 | Vite | 6.x |
| 前端框架 | Vue 3（Composition API） | 3.5.x |
| 类型系统 | TypeScript | 5.6.x |
| UI 组件库 | Vant（按需自动导入） | 4.10.x |
| 原子化 CSS | Tailwind CSS | 3.4.x |
| 状态管理 | Pinia | 2.3.x |
| 路由 | Vue Router | 4.6.x |
| 本地存储 | localforage（IndexedDB） | 1.10.x |
| 图表 | ECharts | 5.6.x |
| 大模型 | OpenCode Zen mimo-v2.5-free | - |
| 天气服务 | 和风天气（QWeather）API | v7 |
| 移动端框架 | Capacitor | 8.x |
| JDK | Eclipse Temurin | 21 |

---

## 项目结构

```
src/
├── components/                # 通用组件
│   ├── AppleIcon.vue          # Lucide 风格线框图标（80+ 图标，含天气图标）
│   ├── AuroraButton.vue       # 极光风格按钮
│   ├── BreathingGuide.vue     # 呼吸引导（CSS3 动画）
│   ├── EChart.vue             # ECharts 封装
│   ├── FeatureTutorial.vue    # 功能级新手教程（Spotlight 遮罩）
│   ├── GlassCard.vue          # 毛玻璃卡片
│   ├── SectionTitle.vue       # 区块标题
│   └── WhiteNoiseMixer.vue    # 白噪音混音台（Web Audio API）
├── composables/               # 组合式函数
│   └── useFeatureTutorial.ts  # 功能教程状态管理（IndexedDB 持久化）
├── constants/                 # 常量与预置数据
│   ├── foodLibrary.ts         # 30 项预置食物库
│   ├── quickQuestions.ts      # 10 项快捷问题
│   └── user.ts                # 用户标签、BMI 计算、目标/活动选项
├── layouts/
│   └── MainLayout.vue         # 4 Tab 主布局
├── router/
│   └── index.ts               # 路由配置（含独立页 showTabBar:false）
├── services/                  # 服务层
│   ├── ai.ts                  # 大模型封装（streamChat / chat / Prompt 构建）
│   ├── foodAnalysis.ts        # 膳食解析（JSON 清洗 + 本地匹配）
│   └── weather.ts             # 天气服务（和风天气 API + 定位 + 缓存）
├── store/                     # Pinia 状态管理
│   └── modules/
│       ├── user.ts            # 用户档案
│       ├── diet.ts            # 饮食记录（localforage 持久化）
│       ├── chat.ts            # AI 健康顾问对话
│       ├── mind.ts            # 心理疏导对话 + 情绪日记
│       └── sleep.ts           # 睡眠记录 + AI 小贴士/周报
├── styles/
│   ├── apple-tokens.css       # Apple Design Token 变量
│   └── main.css               # 全局样式（移动端适配）
├── types/                     # TypeScript 类型定义
│   ├── diet.ts / chat.ts / mind.ts / sleep.ts / echarts.ts / user.ts
├── utils/
│   ├── aiToast.ts             # AI 提示弹窗
│   ├── mockSeed.ts            # Mock 数据注入（开发调试用）
│   └── storage.ts             # localforage 封装
├── views/                     # 页面
│   ├── HomeView.vue           # Tab 1：健康看板（营养 + 雷达图 + 打卡 + 天气 + AI 寄语）
│   ├── AdvisorView.vue        # Tab 2：AI 健康顾问
│   ├── RecordView.vue         # Tab 3：饮食记录（手动 + AI 识别 + 拍照）
│   ├── ProfileView.vue        # Tab 4：我的（档案 + 目标编辑 + 设置）
│   ├── OnboardingView.vue     # 首启建档（3 步）
│   ├── OnboardingTourView.vue # 功能引导教程
│   ├── MindView.vue           # 心理疏导（独立页）
│   └── SleepView.vue          # 睡眠辅助（独立页）
├── App.vue
└── main.ts

android/                       # Capacitor Android 工程
├── app/
│   ├── build.gradle           # 版本号、签名配置
│   └── src/main/
│       ├── AndroidManifest.xml    # 权限（网络 + 定位）
│       └── res/mipmap-*/          # 多密度应用图标
├── build.gradle
└── keystore.properties        # 签名配置（已 gitignore）

scripts/
└── build-apk.mjs              # 一键打包脚本（build → cap sync → gradlew）
```

---

## 快速开始

### 环境要求

- Node.js 18+
- JDK 21（项目内 `.jdk21/` 已自带，或设置 `JAVA_HOME`）
- Android SDK（设置 `ANDROID_HOME`）

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 为 `.env`，填入以下配置：

```env
# AI 大模型 API
VITE_AI_API_KEY=your_api_key
VITE_AI_BASE_URL=/ai-proxy/v1
VITE_AI_MODEL=mimo-v2.5-free
AI_API_KEY=your_api_key

# 和风天气 API（可选，不配置则首页不显示天气）
VITE_QWEATHER_KEY=your_qweather_key
VITE_QWEATHER_HOST=your专属apihost.re.qweatherapi.com
```

> **和风天气配置说明**：注册 https://dev.qweather.com/ → 控制台获取专属 API Host → 添加凭据获取 API Key。和风天气 2026 年起停用公共域名，必须使用专属 Host + `X-QW-Api-Key` 请求头认证。

### 开发

```bash
npm run dev          # 启动开发服务器 → http://localhost:5173
npm run type-check   # 类型检查
```

### 构建

```bash
npm run build        # Web 构建 → dist/
npm run preview      # 预览构建产物
```

### Android APK 打包

```bash
npm run apk:release  # 一键打包 release APK
```

产物路径：`android/app/build/outputs/apk/release/app-release.apk`

> 打包脚本自动完成：Web 构建 → Capacitor 同步 → Gradle assembleRelease。
> 签名配置读取自 `android/keystore.properties`（对应 `.jks` 密钥库文件需自行准备，已加入 `.gitignore`）。

---

## AI 集成说明

### 模型信息

- **提供商**：OpenCode Zen
- **模型**：mimo-v2.5-free（多模态，支持文字 + 图片 + 视频识别）
- **端点**：`https://opencode.ai/zen/v1/chat/completions`
- **API 格式**：OpenAI 兼容（`/chat/completions`）

### AI 能力分布

| 场景 | 调用方式 | Prompt 策略 |
|------|----------|-------------|
| 每日寄语 | 非流式 `chat()` | 用户档案 + 今日营养数据 |
| 健康顾问对话 | 流式 `streamChat()` | 健康顾问 Prompt + 用户画像 + 最近 10 轮历史 |
| 心理疏导对话 | 流式 `streamChat()` | CBT Prompt + 角色风格 + 用户画像 + 近期情绪 |
| 膳食解析 | 非流式 `chat()` | 严格 JSON 输出 Prompt |
| 睡眠小贴士 | 流式 `streamChat()` | 睡眠评分 + 饮食数据 |
| 睡眠周报 | 非流式 `chat()` | 7 日睡眠数据分析 |

### 降级策略

- **API 未配置**：所有 AI 场景回退到本地 mock 回复
- **请求超时**：首字 60 秒超时，自动降级
- **危机干预**：心理疏导在 AI 调用前检测危机关键词，直接返回热线信息

---

## 天气服务

使用和风天气（QWeather）免费 API，通过设备定位获取实时天气，显示在首页右上角。

- **认证方式**：`X-QW-Api-Key` 请求头（非 URL 参数）
- **API Host**：每个账号专属域名（非公共域名 `devapi.qweather.com`，该域名已于 2026 年停用）
- **定位权限**：Android Manifest 已声明 `ACCESS_COARSE_LOCATION` 和 `ACCESS_FINE_LOCATION`
- **缓存策略**：30 分钟本地缓存，避免频繁请求
- **降级处理**：未配置 API 时优雅隐藏天气胶囊，定位失败时静默处理

---

## 移动端适配

- **Safe Area**：顶部/底部安全区适配（`env(safe-area-inset-*)`）
- **高清边框**：1px hairline（`scaleY(0.5)`）
- **触控反馈**：`touch-feedback` 类提供按压反馈
- **惯性滚动**：`-webkit-overflow-scrolling: touch`
- **防滚动穿透**：`overscroll-behavior: contain`
- **最小触控目标**：44px
- **动态视口**：使用 `100dvh` 适配移动浏览器工具栏

---

## 性能优化

- **路由懒加载**：所有页面组件使用 `() => import()` 动动导入
- **ECharts 共享 chunk**：HomeView/MindView/SleepView 共用 ECharts chunk
- **按需导入**：Vant 组件通过 `unplugin-vue-components` 自动按需导入
- **Proxy 转换**：Pinia 响应式数据存入 IndexedDB 前通过 `JSON.parse(JSON.stringify())` 转为纯对象
- **SSE 生命周期**：所有流式组件在 `onUnmounted` 中中止请求，防止内存泄漏

---

## 隐私与数据安全

- **本地优先**：所有用户数据（档案、饮食、对话、睡眠、情绪）仅存储在本地 IndexedDB
- **无后端**：Demo 阶段不部署后端服务器，AI 请求直连大模型 API
- **API Key 安全**：通过 `.env` 注入，不硬编码在源码中；`.env` 已加入 `.gitignore`
- **签名密钥保护**：`keystore.properties` 和 `.jks` 文件已加入 `.gitignore`

---

## 已知限制

- **H5 后台音频**：浏览器切后台时 Web Audio 会被系统暂停（APK 通过 Capacitor 原生桥解决）
- **食物库扩充**：当前 30 项预置食材，未来可支持 AI 动态扩充
- **和风天气 API 限制**：开发版免费额度有限，高频请求可能触发限流

---

## License

本项目为字节跳动 Trae AI 创作力大赛参赛作品，仅供展示与评审使用。
