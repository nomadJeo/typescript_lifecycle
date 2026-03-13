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

## 更新历程（与主模块对应）


与 CLI / 分析流程相关的关键阶段摘要：

| 阶段/版本 | 原因与修复要点 |
|-----------|----------------|
| **首次修复（排序 1–5）** | 漏报：fs.open、getRdbStore 等规则缺失；误报：DummyMain 未含 aboutToDisappear。扩展 Source/Sink 规则，DummyMain 加入 aboutToDisappear。 |
| **Fix 1–4** | resourceLeakCount 与 leakDetails 不一致 → 改为使用 taintAnalysisSummary.resourceLeaks.length；aboutToDisappear 污点配对 → handleAssignmentSource / matchesAccessPathForArg / getExitToReturnFlowFunction；getRdbStore.fallback；setInterval 返回值未存储 → $setInterval_discarded。 |
| **阶段一** | 30 项目回归：rdb.getRdbStore、openSync.fallback；OxHornCampus 断言改为 toBeGreaterThanOrEqual(1)。 |
| **阶段二** | aboutToDisappear 内已有 clear 仍误报 → LifecycleLeakSuppressor 结构性抑制 Timer 泄漏。 |
| **阶段四** | 入口优先 → LifecycleModelCreator 对 abilities/components 按 isEntry 排序。 |
| **阶段五** | LinysBrowser 栈溢出导致整轮中断 → analyze 内 try-catch，buildErrorResult 降级并写入 errors；脚本对 result.errors 写入输出。 |
| **v2.2.0** | Map.set/Set.add/Array.push 作 Source 导致误报激增 → 删除该 7 条规则，规则键用 id。 |
| **v2.3.0** | ViewTree 环导致 KeePassHO/LinysBrowser 栈溢出；防抖情形 3、File await close 误报；规则扩展（ResultSet/AVPlayer/CommonEvent）；ID 丢弃仅 setInterval。KeePassHO/LinysBrowser 全量可分析；全量脚本 `scripts/analyze-new-projects.ts`，两项目专项 `scripts/test-two-projects.ts`。 |
| **bounds** | 有界约束（maxCallbackIterations、k=1/k=2）通过 LifecycleAnalyzer 的 options 或 TaintAnalysisRunner config 传入，见主 README 与 taint/README。 |

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 2.3.0 | 2026-03-11 | 与 TEST_lifecycle 同步：防抖/File 抑制、新增规则与 ViewTree 环检测后，KeePassHO/LinysBrowser 等可完整分析；全量脚本见 `scripts/analyze-new-projects.ts` |
| 1.0.0 | 2025-03-01 | 初始版本，支持基础分析和报告生成 |
| 2.0.0 | 2026-03-01 | 集成污点分析，支持资源/闭包/内存泄漏检测，DummyMain 接入 IFDS |
