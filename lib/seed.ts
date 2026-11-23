import type { KnowledgeItem } from "./types";

/**
 * 冷启动内容：第一次部署、还没跑定时抓取时，知识库里也有东西可看。
 * 这些是「长期有效」的官方指南，不追新闻时效。
 */
export const SEED_ITEMS: KnowledgeItem[] = [
  {
    id: "seed-openai-prompting",
    title: "OpenAI 官方提示词指南：六大策略与示例",
    url: "https://platform.openai.com/docs/guides/prompt-engineering",
    source: "OpenAI 官方文档",
    summary:
      "官方给出的提示词写法清单：写清指令、提供参考文本、把复杂任务拆成子任务、给模型思考时间、善用外部工具、系统性地测试改动。适合当作检查表，每次 AI 答得不好就回来对一遍。",
    points: [
      "指令要具体：说清输出格式、长度、受众",
      "复杂任务拆步骤，让模型一步步来",
      "给例子（few-shot）比反复解释要求更有效",
      "把「不许做什么」换成「应该做什么」",
    ],
    category: "skill",
    tags: ["提示词", "官方文档", "入门必读"],
    level: "入门",
    publishedAt: "2026-11-10T00:00:00.000Z",
    crawledAt: "2026-11-10T00:00:00.000Z",
    lang: "en",
  },
  {
    id: "seed-anthropic-prompts",
    title: "Anthropic 提示词库：按场景挑现成模板",
    url: "https://docs.anthropic.com/en/prompt-library/library",
    source: "Anthropic 官方文档",
    summary:
      "几十个按真实场景分类的提示词模板（写作、编程、数据分析、客服、教育……），每条都给了输入输出示例。最适合新手的方式：先抄一个最接近的，再改三个词。",
    points: [
      "按任务类型找模板，比从零写快得多",
      "注意模板里的「变量」位置，那就是你要改的地方",
      "同一模板换受众/语气，可以复用很久",
    ],
    category: "skill",
    tags: ["提示词", "模板库", "可直接抄"],
    level: "入门",
    publishedAt: "2026-11-08T00:00:00.000Z",
    crawledAt: "2026-11-08T00:00:00.000Z",
    lang: "en",
  },
  {
    id: "seed-google-prompting",
    title: "Google 提示词指南：清晰、简洁、给上下文",
    url: "https://ai.google.dev/gemini-api/docs/prompting-strategies",
    source: "Google AI 文档",
    summary:
      "从「模型不知道你没说的东西」出发讲提示词：明确任务、给足上下文、指定格式、用分隔符切分材料、控制温度。对多模态（图片/文档）输入也有专门建议。",
    points: [
      "用分隔符（如 ###）把指令和材料分开",
      "要 JSON 就给出字段名和示例",
      "需要创意时调高温度，需要稳定时调低",
    ],
    category: "skill",
    tags: ["提示词", "上下文", "多模态"],
    level: "入门",
    publishedAt: "2026-11-06T00:00:00.000Z",
    crawledAt: "2026-11-06T00:00:00.000Z",
    lang: "en",
  },
  {
    id: "seed-mcp",
    title: "MCP 是什么：让 AI 接上你的工具和数据",
    url: "https://modelcontextprotocol.io/introduction",
    source: "Model Context Protocol",
    summary:
      "MCP（Model Context Protocol）是一套开放协议，让 AI 应用用统一方式连接外部工具、数据库、文件系统。以前每个工具都要单独做插件，现在只要实现一次 MCP 服务，所有支持 MCP 的 AI 客户端都能用。",
    points: [
      "一句话：AI 世界的 USB-C 接口",
      "服务端暴露「工具/资源/提示词」，客户端按需调用",
      "对普通用户的意义：AI 能读你的文件、查你的库了",
    ],
    category: "tool",
    tags: ["MCP", "Agent", "工具调用"],
    level: "进阶",
    publishedAt: "2026-11-04T00:00:00.000Z",
    crawledAt: "2026-11-04T00:00:00.000Z",
    lang: "en",
  },
  {
    id: "seed-agent-guide",
    title: "什么是 AI Agent：从「会聊天」到「会干活」",
    url: "https://www.anthropic.com/engineering/building-effective-agents",
    source: "Anthropic Engineering",
    summary:
      "Anthropic 把 Agent 拆成两种：固定流程的 Workflow（可靠、可控）和自主决策的 Agent（灵活、难调试）。结论很实用——能用简单流程解决的就别上 Agent，先把提示词和流程打磨好。",
    points: [
      "Workflow 适合步骤稳定的任务，Agent 适合步骤不确定的任务",
      "给 Agent 的工具要少而精，接口描述要写清楚",
      "一定要有「停下来」的机制，避免无限循环烧钱",
    ],
    category: "research",
    tags: ["Agent", "工作流", "架构"],
    level: "进阶",
    publishedAt: "2026-11-02T00:00:00.000Z",
    crawledAt: "2026-11-02T00:00:00.000Z",
    lang: "en",
  },
  {
    id: "seed-elements-ai",
    title: "给普通人的 AI 入门课：哪些能交给 AI，哪些不能",
    url: "https://www.elementsofai.com/",
    source: "Elements of AI",
    summary:
      "赫尔辛基大学出的免费公开课，不写代码也能学。核心收获是判断力：AI 擅长什么（模式匹配、改写、总结）、不擅长什么（精确计算、实时事实、承担责任），以及它出错时你为什么看不出来。",
    points: [
      "AI 的输出是「最可能的下一段话」，不是查证过的事实",
      "越具体的任务越容易判断对错，越模糊的任务越要人工复核",
      "学会问「这条信息我能不能自己验证」",
    ],
    category: "skill",
    tags: ["入门", "AI 素养", "免费课程"],
    level: "入门",
    publishedAt: "2026-10-28T00:00:00.000Z",
    crawledAt: "2026-10-28T00:00:00.000Z",
    lang: "en",
  },
];
