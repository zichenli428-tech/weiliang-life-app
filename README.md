# 微量生活 · AI 私人健康管家

> 字节跳动 Trae AI 创作力大赛参赛作品
>
> 一款基于大模型的移动端 H5 健康管理应用，覆盖营养膳食分析、AI 心理疏导、睡眠辅助、健康顾问四大核心场景，让健康管理变得轻盈、温暖、可持续。

---

## ✨ 功能特性

### 3.1 营养膳食分析
- **AI 智能解析**：输入"一碗西红柿牛肉面"等模糊描述，大模型自动拆解食材并估算克数
- **本地知识库匹配**：30 项预置中式食材库，按重量精准计算蛋白质/脂肪/碳水/热量
- **用户确认微调**：AI 结果可调整，支持自定义食物录入
- **兜底容错**：AI 识别失败时自动降级为手动输入模式（PRD 7.4 JSON 清洗）

### 3.2 睡眠辅助系统
- **AI 睡眠小贴士**：结合睡眠评分 + 当日饮食数据，流式生成专属助眠建议
- **白噪音混音台**：Web Audio API 程序化生成白/粉/棕噪音 + 雨声/海浪/森林/篝火，6 音轨独立音量、定时关闭
- **呼吸引导**：CSS3 呼吸球动画，支持 4-7-8 助眠法、箱式呼吸法、快速放松法
- **睡眠记录与趋势**：每日评分记录 + 7 日 ECharts 趋势图 + AI 睡眠周报

### 3.3 AI 心理疏导
- **共情式流式对话**：基于 CBT（认知行为疗法）原则的系统提示，打字机效果
- **三种对话风格**：温暖的朋友 / 专业心理咨询师 / 正念导师
- **危机干预**：自杀/自残关键词检测，触发热线预警弹窗
- **情绪日记**：8 种情绪记录 + 强度评分 + 7/30 日趋势图
- **莫兰迪色系**：低饱和度渐变营造安全放松氛围
- **首次免责声明**：明确 AI 边界，保护用户权益

### 3.4 基础功能模块
- **健康看板**：今日营养概览 + 健康雷达图 + 快捷打卡 + AI 每日寄语
- **AI 健康顾问**：多轮上下文对话 + 用户画像注入 System Prompt + 10 项快捷问题
- **首启建档**：3 步完成身体档案设置（性别/身高体重/健康目标）
- **个人中心**：BMI 卡片 + 档案编辑 + 数据管理

### 工程亮点
- **SSE 流式输出**：打字机效果，首字 60 秒超时降级（PRD 7.2，商汤 SenseNova 推理阶段较长）
- **上下文记忆**：最近 10 轮对话 + 用户画像注入 System Prompt（PRD 7.1）
- **本地优先**：所有数据通过 IndexedDB（localforage）持久化，不上传服务器（PRD 4.3）
- **弱网降级**：AI 请求失败时自动回退 mock 回复，交互永不中断
- **移动端适配**：Safe Area 适配、1px 高清边框、触控反馈、惯性滚动

---

## 🛠 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 构建工具 | Vite | 6.4.x |
| 前端框架 | Vue 3（Composition API） | 3.5.x |
| 类型系统 | TypeScript | 5.6.x |
| UI 组件库 | Vant（按需自动导入） | 4.10.x |
| 原子化 CSS | Tailwind CSS | 3.4.x |
| 状态管理 | Pinia | 2.3.x |
| 路由 | Vue Router | 4.6.x |
| 本地存储 | localforage（IndexedDB） | 1.10.x |
| 图表 | ECharts | 5.6.x |
| 大模型 | 商汤 SenseNova sensenova-6.7-flash-lite | - |

---

## 📁 项目结构

```
src/
├── components/              # 通用组件
│   ├── EChart.vue           # ECharts 封装（共享 chunk）
│   ├── WhiteNoiseMixer.vue  # 白噪音混音台（Web Audio API）
│   └── BreathingGuide.vue   # 呼吸引导（CSS3 动画）
├── constants/               # 常量与预置数据
│   ├── foodLibrary.ts       # 30 项预置食物库
│   ├── quickQuestions.ts    # 10 项快捷问题
│   └── user.ts              # 用户相关标签与 BMI 计算
├── layouts/
│   └── MainLayout.vue       # 4 Tab 主布局
├── router/
│   └── index.ts             # 路由配置（含独立页 showTabBar:false）
├── services/                # AI 服务层
│   ├── ai.ts                # 大模型封装（streamChat / chat / Prompt 构建）
│   └── foodAnalysis.ts      # 膳食解析（PRD 7.3/7.4 JSON 清洗 + 本地匹配）
├── store/                   # Pinia 状态管理
│   └── modules/
│       ├── user.ts          # 用户档案
│       ├── diet.ts          # 饮食记录（localforage 持久化）
│       ├── chat.ts          # AI 健康顾问对话
│       ├── mind.ts          # 心理疏导对话 + 情绪日记
│       └── sleep.ts         # 睡眠记录 + AI 小贴士/周报
├── styles/
│   └── main.css             # 全局样式（移动端适配、触控反馈）
├── types/                   # TypeScript 类型定义
│   ├── diet.ts / chat.ts / mind.ts / sleep.ts / echarts.ts
├── utils/
│   └── storage.ts           # localforage 封装（含 Proxy 转换）
├── views/                   # 页面
│   ├── HomeView.vue         # Tab 1：健康看板
│   ├── AdvisorView.vue      # Tab 2：AI 健康顾问
│   ├── RecordView.vue       # Tab 3：饮食记录
│   ├── ProfileView.vue      # Tab 4：我的
│   ├── OnboardingView.vue   # 首启建档
│   ├── MindView.vue         # 心理疏导（独立页）
│   └── SleepView.vue        # 睡眠辅助（独立页）
├── App.vue
└── main.ts
```

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装依赖

```bash
npm install
```

### 配置 AI API

在项目根目录创建 `.env` 文件：

```env
VITE_AI_API_KEY=your_api_key
VITE_AI_BASE_URL=https://token.sensenova.cn/v1
VITE_AI_MODEL=sensenova-6.7-flash-lite
```

> 开发环境通过 Vite 代理（`/ai-proxy`）绕过浏览器 CORS 限制。
> 生产环境需部署后端代理转发 AI 请求。

### 启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5173`，建议使用 Chrome DevTools 移动端模拟器查看。

### 类型检查

```bash
npm run type-check
```

### 生产构建

```bash
npm run build
```

构建产物输出至 `dist/`。

### 预览构建产物

```bash
npm run preview
```

---

## 🤖 AI 集成说明

### 模型信息

- **提供商**：商汤日日新 SenseNova
- **模型**：sensenova-6.7-flash-lite
- **API 格式**：OpenAI 兼容（`/chat/completions`）
- **采样参数**：仅支持 `temperature` 和 `stop`（不支持 `max_tokens`）

### AI 能力分布

| 场景 | 调用方式 | Prompt 策略 |
|------|----------|-------------|
| 每日寄语 | 非流式 `chat()` | 用户档案 + 今日营养数据 |
| 健康顾问对话 | 流式 `streamChat()` | 健康顾问 Prompt + 用户画像 + 最近 10 轮历史 |
| 心理疏导对话 | 流式 `streamChat()` | CBT Prompt + 角色风格 + 用户画像 + 近期情绪 |
| 膳食解析 | 非流式 `chat()` | PRD 7.3 严格 JSON 输出 Prompt |
| 睡眠小贴士 | 流式 `streamChat()` | 睡眠评分 + 饮食数据 |
| 睡眠周报 | 非流式 `chat()` | 7 日睡眠数据分析 |

### 降级策略

- **API 未配置**：所有 AI 场景回退到本地 mock 回复
- **请求超时**：首字 60 秒超时（PRD 7.2，适配 SenseNova 推理阶段），自动降级
- **危机干预**：心理疏导在 AI 调用前检测危机关键词，直接返回热线信息

---

## 📱 移动端适配

- **Safe Area**：顶部/底部安全区适配（`env(safe-area-inset-*)`）
- **高清边框**：1px hairline（`scaleY(0.5)`）
- **触控反馈**：`touch-feedback` 类提供按压反馈
- **惯性滚动**：`-webkit-overflow-scrolling: touch`
- **防滚动穿透**：`overscroll-behavior: contain`
- **最小触控目标**：44px
- **动态视口**：使用 `100dvh` 适配移动浏览器工具栏

---

## ⚡ 性能优化

- **路由懒加载**：所有页面组件使用 `() => import()` 动态导入
- **ECharts 共享 chunk**：HomeView/MindView/SleepView 共用 516KB（gzip 173KB）ECharts chunk
- **按需导入**：Vant 组件通过 `unplugin-vue-components` 自动按需导入
- **Proxy 转换**：Pinia 响应式数据存入 IndexedDB 前通过 `JSON.parse(JSON.stringify())` 转为纯对象
- **SSE 生命周期**：所有流式组件在 `onUnmounted` 中中止请求，防止内存泄漏（PRD 7.2 #2）

---

## 🔒 隐私与数据安全

- **本地优先**：所有用户数据（档案、饮食、对话、睡眠、情绪）仅存储在本地 IndexedDB
- **无后端**：Demo 阶段不部署后端服务器，AI 请求直连大模型 API
- **API Key**：仅开发环境通过 `.env` 注入，不硬编码在源码中

---

## 📋 PRD 合规说明

| PRD 章节 | 状态 | 实现说明 |
|----------|------|----------|
| 3.1 营养膳食分析 | ✅ | AI 解析 + 本地知识库 + 用户确认 + 兜底 |
| 3.2 睡眠辅助 | ✅ | AI 小贴士 + 白噪音 + 呼吸引导 + 记录趋势 |
| 3.3 AI 心理疏导 | ✅ | 流式对话 + 情绪感知 + 危机干预 + 情绪日记 |
| 3.4 基础功能 | ✅ | 4 Tab + 看板 + 顾问 + 记录 + 我的 |
| 4.3 本地存储 | ✅ | localforage (IndexedDB) |
| 5.2 大模型封装 | ✅ | SenseNova（用户指定替代 PRD 中的豆包） |
| 7.1 上下文记忆 | ✅ | 最近 10 轮 + 用户画像注入 System Prompt |
| 7.2 弱网超时降级 | ✅ | 首字 60 秒超时（适配 SenseNova 推理阶段）+ mock 降级 + SSE 生命周期管理 |
| 7.3 System Prompt | ✅ | 膳食解析严格 JSON 输出 Prompt |
| 7.4 JSON 清洗 | ✅ | 边界查找法 + Markdown 标记剥离 |

---

## 🔄 开发阶段

| 阶段 | 周期 | 内容 | 状态 |
|------|------|------|------|
| P1 基建 | Day 1-3 | Vite+Vue3+TS 初始化，Vant/Tailwind 配置 | ✅ 完成 |
| P2 业务 | Day 4-7 | 4 Tab 页面 UI，路由/状态管理，移动端适配 | ✅ 完成 |
| P3 AI 核心 | Day 8-11 | 大模型 API 封装，SSE 流式，营养计算，心理疏导，睡眠辅助 | ✅ 完成 |
| P4 冲刺 | Day 12-14 | 全链路测试，Bug 修复，README，演示视频 | ✅ 完成 |

---

## 📝 已知限制与未来规划

- **H5 后台音频**：浏览器切后台时 Web Audio 会被系统暂停，需保持屏幕常开（APK 阶段用 Capacitor 调用原生后台音频解决）
- **ECharts chunk 体积**：516KB（gzip 173KB），未来可用 manualChunks 进一步拆分
- **离线暂存**：弱网拍照暂存队列待实现（PRD 7.1 建议）
- **食物库扩充**：当前 30 项，未来支持 AI 动态扩充知识库

---

## 📄 License

本项目为字节跳动 Trae AI 创作力大赛参赛作品，仅供展示与评审使用。
