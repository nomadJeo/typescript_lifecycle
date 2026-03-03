# HarmonyOS 生命周期分析 CLI 工具

## 概述

本工具提供命令行接口，用于分析 HarmonyOS 项目的生命周期结构，并集成污点分析进行资源/闭包/内存泄漏检测。

## 功能特性

- **项目分析**: 分析 Ability、Component 和 UI 回调
- **多种报告格式**: 支持 JSON、Text、HTML、Markdown
- **DummyMain 生成**: 生成用于静态分析的虚拟入口函数
- **导航分析**: 识别页面跳转关系
- **资源泄漏检测（简化版）**: 方法内 Source/Sink 匹配检测
- **IFDS 污点分析**: 以 DummyMain 为入口的跨过程污点分析（资源/闭包/内存泄漏）

## 使用方式

### 通过测试运行

```bash
# 运行 CLI 测试
cd arkanalyzer-master/arkanalyzer-master
npx vitest run tests/unit/lifecycle/CLIAnalyzer.test.ts
```

### 编程接口

```typescript
import { LifecycleAnalyzer, ReportGenerator } from './TEST_lifecycle/cli';

// 1. 创建分析器
const analyzer = new LifecycleAnalyzer({
    verbose: true,
    inferTypes: true,
    generateDummyMain: true,
    detectResourceLeaks: true,
    runTaintAnalysis: true,
});

// 2. 分析项目
const result = await analyzer.analyze('/path/to/harmonyos/project');

// 3. 生成报告
const generator = new ReportGenerator();

// JSON 报告
const jsonReport = generator.generate(result, { format: 'json' });

// HTML 报告（保存到文件）
generator.generate(result, {
    format: 'html',
    outputPath: './report.html',
    title: '项目分析报告',
});
```

## 分析结果结构

```typescript
interface AnalysisResult {
    project: {
        path: string;
        name: string;
        analyzedAt: string;
    };
    summary: {
        totalFiles: number;
        totalClasses: number;
        abilityCount: number;
        componentCount: number;
        lifecycleMethodCount: number;
        uiCallbackCount: number;
        navigationCount: number;
        resourceLeakCount: number;
    };
    abilities: AbilityAnalysisResult[];
    components: ComponentAnalysisResult[];
    navigations: NavigationSummary[];
    dummyMain?: DummyMainSummary;
    uiCallbacksByType: Record<string, number>;
    resourceLeaks?: { summary: ResourceLeakSummary; leaks: ResourceLeakReport[]; };
    taintAnalysis?: TaintAnalysisSummary;  // IFDS 污点分析结果
    duration: { /* 各阶段耗时 */ };
}
```

## 报告格式

### JSON

完整的结构化数据，适合程序处理。

### Text

```
============================================================
HarmonyOS 生命周期分析报告
============================================================

【项目信息】
  路径: /path/to/project
  名称: MyProject
  
【统计摘要】
  Ability: 2
  Component: 5
  UI 回调: 12
```

### HTML

美观的可视化报告，包含：
- 统计卡片
- Ability/Component 表格
- UI 回调分布图
- 导航关系图

### Markdown

适合在 GitHub、GitLab 等平台展示的文档格式。

## 配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sdkPath` | string | - | HarmonyOS SDK 路径 |
| `inferTypes` | boolean | true | 是否进行类型推断 |
| `generateDummyMain` | boolean | true | 是否生成 DummyMain |
| `analyzeNavigation` | boolean | true | 是否分析导航关系 |
| `extractUICallbacks` | boolean | true | 是否提取 UI 回调 |
| `verbose` | boolean | false | 是否输出详细日志 |
| `detectResourceLeaks` | boolean | true | 是否运行简化版资源泄漏检测 |
| `runTaintAnalysis` | boolean | true | 是否运行完整 IFDS 污点分析 |

## 文件结构

```
cli/
├── index.ts              # 模块入口
├── LifecycleAnalyzer.ts  # 核心分析器（集成生命周期 + 污点分析）
├── ReportGenerator.ts    # 报告生成器
├── cli.ts                # 命令行入口
└── README.md             # 本文档
```

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-03-01 | 初始版本，支持基础分析和报告生成 |
| 2.0.0 | 2026-03-01 | 集成污点分析，支持资源/闭包/内存泄漏检测，DummyMain 接入 IFDS |
