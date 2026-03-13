# TypeScript Lifecycle - 基于有界生命周期模型的 TypeScript 缺陷检测

> **基于 ArkAnalyzer 的扩展版生命周期建模 + 污点分析框架**
> 
> 本项目扩展了 ArkAnalyzer 的 `DummyMainCreater`，实现多 Ability 支持、精细化 UI 回调建模，并集成 IFDS 污点分析进行资源/闭包/内存泄漏检测。

[![GitHub](https://img.shields.io/badge/GitHub-typescript__lifecycle-blue)](https://github.com/kemoisuki/typescript_lifecycle)

---

## 📦 项目结构

```
typescript/
├── README.md                           # 本文件
├── arkanalyzer-master/
│   └── arkanalyzer-master/
│       ├── src/
│       │   ├── core/                   # ArkAnalyzer 核心
│       │   ├── callgraph/              # 调用图
│       │   └── TEST_lifecycle/         # ⭐ 生命周期建模 + 污点分析
│       │       ├── LifecycleTypes.ts
│       │       ├── AbilityCollector.ts
│       │       ├── NavigationAnalyzer.ts
│       │       ├── ViewTreeCallbackExtractor.ts
│       │       ├── LifecycleModelCreator.ts
│       │       ├── taint/              # 🆕 污点分析模块
│       │       │   ├── TaintFact.ts
│       │       │   ├── SourceSinkManager.ts
│       │       │   ├── TaintAnalysisProblem.ts
│       │       │   ├── TaintAnalysisSolver.ts
│       │       │   └── ResourceLeakDetector.ts
│       │       ├── cli/                # 工程化 CLI
│       │       │   ├── LifecycleAnalyzer.ts
│       │       │   └── ReportGenerator.ts
│       │       └── gui/                # Web 可视化
│       └── tests/unit/lifecycle/       # 测试用例
├── Demo4tests/                         # 真实 HarmonyOS 项目（验证用）
├── FlowDroid-develop/                  # FlowDroid 参考实现
└── 基于有界生命周期模型的TypeScript缺陷检测技术研究-fs.md
```

---

## 🎯 项目目标

本项目旨在扩展 ArkAnalyzer 的 DummyMain 机制，并在此基础上实现缺陷检测：

| 功能 | 原版 | 扩展版 |
|------|:----:|:------:|
| 多 Ability 支持 | ❌ | ✅ |
| 页面跳转建模 | ❌ | ✅ |
| 精细化 UI 回调 | ❌ | ✅ |
| ViewTree 整合 | ❌ | ✅ |
| 资源泄漏检测 | ❌ | ✅ |
| 闭包泄漏检测 | ❌ | ✅ |
| 内存泄漏检测 | ❌ | ✅ |
| IFDS 污点分析 | ❌ | ✅ |

---

## 🚀 快速开始

### 使用扩展版 DummyMain

```typescript
import { Scene } from './arkanalyzer-master/arkanalyzer-master/src/Scene';
import { LifecycleModelCreator } from './arkanalyzer-master/arkanalyzer-master/src/TEST_lifecycle';

// 1. 构建 Scene
const scene = new Scene();
scene.buildSceneFromProjectDir('/path/to/harmonyos/project');

// 2. 创建扩展版 DummyMain
const creator = new LifecycleModelCreator(scene);
creator.create();

// 3. 获取结果
const dummyMain = creator.getDummyMain();
const abilities = creator.getAbilities();
const components = creator.getComponents();

// 4. 运行污点分析
import { TaintAnalysisRunner } from './arkanalyzer-master/arkanalyzer-master/src/TEST_lifecycle/taint/TaintAnalysisSolver';

const runner = new TaintAnalysisRunner(scene);
const result = runner.runFromDummyMain();
console.log(`资源泄漏: ${result.resourceLeaks.length}, 污点泄漏: ${result.taintLeaks.length}`);
```

### 使用一站式分析器

```typescript
import { LifecycleAnalyzer } from './arkanalyzer-master/arkanalyzer-master/src/TEST_lifecycle/cli';

const analyzer = new LifecycleAnalyzer({
    generateDummyMain: true,
    detectResourceLeaks: true,
    runTaintAnalysis: true,
    // 有界约束（三条有界化约束均可调节）
    bounds: {
        maxCallbackIterations: 1,    // 约束2：DummyMain CFG 循环展开次数（默认 1 = DAG）
        maxAbilitiesPerFlow: 3,      // 约束1：单条数据流最多访问的 Ability 数
        maxNavigationHops: 5,        // 约束3：单条数据流最多经过的导航跳数
    },
});
const result = await analyzer.analyze('/path/to/harmonyos/project');
```

---

## 📖 核心模块说明

### TEST_lifecycle 模块

| 文件/目录 | 功能 |
|------|------|
| `LifecycleTypes.ts` | 类型定义（Ability/Component 信息结构） |
| `AbilityCollector.ts` | 收集所有 Ability 和 Component，识别入口 |
| `NavigationAnalyzer.ts` | 路由分析（支持 router/startAbility/NavPathStack 全覆盖） |
| `ViewTreeCallbackExtractor.ts` | 从 ViewTree 提取 UI 回调 |
| `LifecycleModelCreator.ts` | 核心构建器，生成 DummyMain |
| `taint/TaintFact.ts` | 污点数据结构（AccessPath + SourceContext） |
| `taint/SourceSinkManager.ts` | 86 条 HarmonyOS Source/Sink 规则 |
| `taint/TaintAnalysisProblem.ts` | IFDS 问题定义（继承 DataflowProblem） |
| `taint/TaintAnalysisSolver.ts` | IFDS 求解器 + 分析运行器 |
| `taint/ResourceLeakDetector.ts` | 简化版方法内泄漏检测 |
| `cli/LifecycleAnalyzer.ts` | 一站式分析入口（生命周期 + 污点） |
| `cli/ReportGenerator.ts` | 多格式报告生成（JSON/HTML/Text/Markdown） |

### 关键技术点

```
┌─────────────────────────────────────────────────────────────┐
│ ① 路由参数解析 (extractRouterUrl)                           │
│    router.pushUrl(options) → 追踪变量 → 提取 url 字段       │
├─────────────────────────────────────────────────────────────┤
│ ② Want 对象解析 (extractWantTarget)                         │
│    startAbility(want) → 追踪变量 → 提取 abilityName 字段    │
├─────────────────────────────────────────────────────────────┤
│ ③ 入口识别 (checkIsEntryAbility)                            │
│    读取 module.json5 → 解析 mainElement → 确定入口 Ability  │
├─────────────────────────────────────────────────────────────┤
│ ④ 回调方法解析 (resolveCallbackMethod)                      │
│    onClick(handler) → 解析 MethodSig/FieldRef → ArkMethod  │
├─────────────────────────────────────────────────────────────┤
│ ⑤ 生命周期参数生成 (addMethodInvocation)                    │
│    onCreate() → 生成 new Want() → onCreate(want) 完整调用  │
├─────────────────────────────────────────────────────────────┤
│ ⑥ UI 回调参数生成 (addUICallbackInvocation)                 │
│    handleClick() → 生成 new ClickEvent() → handleClick(e)  │
└─────────────────────────────────────────────────────────────┘
```

### 工作流程

```mermaid
flowchart LR
    A[Scene] --> B[收集 Ability]
    A --> C[收集 Component]
    B --> D[分析路由关系]
    C --> D
    C --> E[提取 ViewTree 回调]
    D --> F[构建 DummyMain CFG]
    E --> F
    F --> G["@extendedDummyMain"]
```

---

## 📚 详细文档

👉 **[查看完整文档](arkanalyzer-master/arkanalyzer-master/src/TEST_lifecycle/README.md)**

文档包含：
- 背景与动机
- 核心概念详解（Ability、Component、ViewTree）
- 模块架构图
- 完整流程解析（含图解）
- 类与函数详解
- 使用示例
- TODO 与扩展点
- 常见问题

---

## 🔧 TODO

### 已完成 ✅

**v1.0.0 - 生命周期建模**
- [x] NavigationAnalyzer 路由分析器
- [x] AbilityCollector 信息收集 + module.json5 入口识别
- [x] ViewTreeCallbackExtractor 精细化 UI 回调提取
- [x] LifecycleModelCreator 扩展版 DummyMain 生成
- [x] 4 个真实华为 Codelab 项目验证通过

**v2.0.0 - 污点分析**
- [x] TaintFact 数据结构（借鉴 FlowDroid）
- [x] SourceSinkManager（86 条 HarmonyOS 规则：资源/闭包/内存）
- [x] TaintAnalysisProblem（IFDS 问题定义）
- [x] TaintAnalysisSolver + TaintAnalysisRunner
- [x] ResourceLeakDetector 简化版方法内检测
- [x] LifecycleAnalyzer 一站式集成
- [x] 4 个真实项目污点分析验证

**v2.1.0 - 有界约束完整实现**
- [x] **约束1（Ability 数量限制）**：`checkAbilityBoundary` + `TaintFact.visitedAbilities` 跨 Ability 数据流截断
- [x] **约束2（UI 回调迭代次数）**：`LifecycleModelCreator` 循环展开 + `maxCallbackIterations` 全链路传递
- [x] **约束3（导航跳转次数）**：`isNavigationCall` + `TaintFact.navigationCount` 截断导航数据流
- [x] **NavPathStack 导航支持**：`pushPath` / `pushPathByName` / `replacePath` / `replacePathByName` 全覆盖
- [x] **SourceSinkManager Bug 修复**：相同 pattern 多条规则不再互相覆盖（key 改为 id）
- [x] **LifecycleAnalyzer.bounds 参数**：三条约束均可通过 `AnalysisOptions.bounds` 配置
- [x] 提升测试断言强度（有界/无界对比 + 泄漏内容验证 + 约束专项测试）

**v2.2.0 - 规则精度改进**
- [x] **删除超泛化 Source 规则**：移除 Map.set / Set.add / Array.push（消除 MultiVideo +85、OxHornCampus +6、TransitionBefore +6 误报）
- [x] **新增分布式 API 规则**：distributedDataObject.create / DataObject.on / DataObject.off
- [x] **新增 display 事件规则**：display.on / display.off（折叠屏事件泄漏支持）
- [x] **导航分析扩展到 Component**：Component 类中的 pushPath/pushPathByName 现已可被检测到

### 待完成 / 已知局限
- [x] ~~修复 DummyMain CFG 与 DataflowSolver 兼容性~~ (v2.0.1 已修复)
- [x] ~~NavPathStack 导航支持~~ (v2.1.0 已完成)
- [x] ~~有界化约束实现~~ (v2.1.0 已完成)
- [ ] **链式调用导航漏检**：`getUIContext().getRouter().pushUrl()` 需类型追溯，OxHornCampus 等项目漏检
- [ ] **跨方法资源泄漏漏检**：AVPlayer 跨 3 层方法追踪（MultiVideoApplication）
- [ ] **静态命名空间 className 丢失**：ArkAnalyzer IR 对 `distributedDataObject.create()` 等静态调用 className 解析为空字符串
- [ ] Lambda 完整支持

---

## 🧪 测试

### 测试结果

```
 Test Files  ~10 passed
      Tests  260+ passed
   Duration  ~30s (不含 Demo4tests 真实项目测试)
```

### 测试覆盖

| 层级 | 测试内容 | 状态 |
|------|---------|:----:|
| L1 单元测试 | AbilityCollector, ViewTreeCallbackExtractor, NavigationAnalyzer | ✅ |
| L2 集成测试 | 模块间协作 | ✅ |
| L3 端到端测试 | 完整 DummyMain 生成 | ✅ |
| L4 复杂场景 | 多事件类型、嵌套组件 | ✅ |
| L5 边界情况 | 空组件、最小化 Ability | ✅ |
| L6 结构验证 | CFG 结构、参数生成 | ✅ |
| L7 性能测试 | 处理时间基准 (246ms) | ✅ |
| **L8 真实项目验证** | 4 个华为 Codelab 项目 | ✅ |
| **L9 污点分析单元测试** | TaintFact, SourceSinkManager, TaintAnalysisProblem | ✅ |
| **L10 污点分析集成测试** | TaintAnalysisSolver, TaintAnalysisRunner | ✅ |
| **L11 真实项目污点分析** | 4 个项目 Scene/DummyMain/Source/Sink 验证 | ✅ |
| **L12 有界/无界对比测试** | OxHornCampus 有界约束效果验证 + 泄漏内容断言 | ✅ |
| **L13 约束专项测试** | 约束1/2/3 专项截断效果验证 | ✅ |

### 真实项目验证

| 项目 | 难度 | 类 | 方法 | Source | Sink | IFDS 方法 | IFDS 事实 | 资源泄漏 |
|------|:----:|---:|-----:|-------:|-----:|----------:|----------:|--------:|
| **RingtoneKit** | 初级 | 10 | 32 | 0 | 0 | 19 | 169 | 0 |
| **UIDesignKit** | 初级 | 66 | 169 | 0 | 0 | 54 | 562 | 0 |
| **CloudFoundationKit** | 中级 | 16 | 49 | 0 | 0 | 22 | 184 | 0 |
| **OxHornCampus** | 高级 | 392 | 968 | 9 | 1 | 161 | 2644 | **1** |

### 运行测试

```bash
cd arkanalyzer-master/arkanalyzer-master
npm install                                          # 首次需要
npx vitest run tests/unit/lifecycle/ --reporter=verbose
```

详细测试说明见 `tests/resources/lifecycle/README.md`

### 官方源码 vs 扩展框架 10 项目对比

若已将**官方 ArkAnalyzer 源码**（arkanalyzer-master-source）放在仓库根目录，可运行完整对比：

```bash
# 方式一：分步运行后汇总
cd arkanalyzer-master-source && npm install && npx vitest run tests/unit/benchmark/Demo4testsOriginalBenchmark
cd arkanalyzer-master/arkanalyzer-master && npx vitest run tests/unit/lifecycle/Demo4testsComparison
node tools/compare-original-extended.mjs

# 方式二：一键运行（自动执行上述步骤）
node tools/compare-original-extended.mjs --run-all
```

对比结果写入 `tools/comparison-results/`，并输出汇总表。扩展框架在 10 个 Demo4tests 项目上可检出资源泄漏，官方源码无泄漏检测功能。

---

## 👥 贡献者

- **YiZhou** - 项目负责人
- **AI Assistant** - 代码框架与文档

---

## 📅 更新日志

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-03-07 | v2.2.0 | **规则精度改进**：删除 Map.set/Set.add/Array.push 超泛化规则（消除 MultiVideo 85个误报）+ 新增分布式 API / display 事件规则 + 导航分析扩展到 Component 类 |
| 2026-03-01 | v2.1.0 | **有界约束完整实现**：三条约束全链路接入 + NavPathStack 支持 + SourceSinkManager Bug 修复 + 测试断言强化 |
| 2026-03-01 | v2.0.1 | **修复 DummyMain CFG 兼容性** + AccessPath 参数错位，四个真实项目 IFDS 完整通过（OxHornCampus 检出 1 资源泄漏） |
| 2026-03-01 | v2.0.0 | **污点分析集成**：IFDS 求解器 + 86 条 Source/Sink 规则 + DummyMain 接入 + 4 个真实项目验证 |
| 2025-03-01 | v1.0.0 | **生命周期建模**：4 个真实华为 Codelab 项目验证通过，JSON5 解析修复 |
| 2025-02-10 | v0.9.0 | 增强动态路由参数解析，支持对象字面量 URL 提取 |
| 2025-02-06 | v0.8.0 | 扩展测试套件至 27 项，覆盖复杂场景和边界情况 |
| 2025-01-29 | v0.7.0 | 添加基础测试套件，17 项测试全部通过 |
| 2025-01-28 | v0.6.0 | 实现 addUICallbackInvocation() UI 回调参数生成 |
| 2025-01-28 | v0.5.0 | 实现 addMethodInvocation() 生命周期方法参数生成 |
| 2025-01-28 | v0.4.0 | 实现 resolveCallbackMethod() 回调方法解析 |
| 2025-01-27 | v0.3.0 | 完善路由参数解析和 module.json5 入口识别 |
| 2025-01-27 | v0.2.0 | 新增 NavigationAnalyzer 路由分析器 |
| 2025-01-17 | v0.1.0 | 初始框架完成，包含基本结构和文档 |

---

## 🔄 版本回滚

如需回滚到本次更新（2026-03-07 生命周期分析模块更新）的版本，可使用以下命令：

```bash
# 1. 查看本次提交的哈希（可选，用于确认）
git log -1 --oneline
# 输出示例: 1fd8a95 feat: 生命周期分析模块更新 - 污点分析、测试文档与有界约束

# 2. 回滚到本次提交（保留工作区修改）
git checkout 1fd8a95

# 3. 若需创建新分支并回滚到该版本
git checkout -b rollback-20260307 1fd8a95

# 4. 若需强制将 main 分支重置到该版本（慎用，会丢弃之后的提交）
git reset --hard 1fd8a95
git push --force typescript_lifecycle main
```

| 场景 | 推荐命令 |
|------|----------|
| 仅本地查看该版本代码 | `git checkout 1fd8a95` |
| 基于该版本开新分支开发 | `git checkout -b 新分支名 1fd8a95` |
| 完全丢弃之后提交并推送到远程 | `git reset --hard 1fd8a95` + `git push --force` |

> ⚠️ `git push --force` 会覆盖远程历史，多人协作时请先与团队确认。

---

## 📄 许可证

本项目基于 Apache License 2.0 许可证。

---

> 如有问题，欢迎提 Issue 或 PR！
