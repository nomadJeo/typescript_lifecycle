# Web 可视化增强规划

> 基于有界生命周期模型的 TypeScript 缺陷检测技术研究 - Web 工具功能规划  
> 目标：在现有 GUI 基础上，支持输入项目路径、运行污点分析，并展示计划书中的关键信息（Source/Sink 数目、位置、泄漏检测等）

---

## 一、计划书（基于有界生命周期模型的TypeScript缺陷检测技术研究-fs.md）中的关键信息

| 类别 | 关键信息 | 说明 |
|------|----------|------|
| **污点分析基础** | Source 数目 | 污点源（资源申请点）数量 |
| | Sink 数目 | 污点汇（资源释放点）数量 |
| | Source/Sink 位置 | 文件路径、行号、列号，便于定位 |
| **缺陷检测结果** | 资源泄漏数 | Source 未到达配对的 Sink |
| | 闭包泄漏数 | setInterval 等未配对 clearInterval |
| | 内存泄漏数 | Worker 等未释放 |
| | 污点泄漏数 | 敏感数据到达危险 Sink |
| **有界约束** | 约束 1 | 单条数据流涉及的逻辑组件数量 |
| | 约束 2 | UI 事件响应次数（maxCallbackIterations） |
| | 约束 3 | 导航跳数限制 |
| **分析过程** | Ability/Component 数 | 生命周期建模范围 |
| | IFDS 方法数 / 事实数 | 分析规模指标 |
| | 各阶段耗时 | Scene、DummyMain、IFDS 等 |

---

## 二、现有 GUI 能力与缺口

### 2.1 已有功能

- 项目路径输入、校验
- 分析选项：类型推断、DummyMain、导航、UI 回调
- 结果展示：Ability、Component、UI 回调、导航关系、耗时
- 报告导出：JSON/Text/HTML/Markdown

### 2.2 当前缺口

| 缺口 | 说明 |
|------|------|
| 污点分析未启用 | server.ts 调用 LifecycleAnalyzer 时未传 `runTaintAnalysis: true` |
| 无 Source/Sink 展示 | 未展示 Source 数、Sink 数及位置 |
| 无泄漏详情 | 未展示资源/闭包/内存泄漏列表及定位 |
| 无可配置有界约束 | 未提供 maxCallbackIterations、maxAbilitiesPerFlow 等配置 |
| 无 Source/Sink 位置 | 需新增扫描逻辑，收集项目中所有 Source/Sink 调用位置 |

---

## 三、功能规划清单

### Phase 1：污点分析接入与基础统计（优先级：高）

| 序号 | 功能 | 说明 | 依赖 |
|------|------|------|------|
| 1.1 | 污点分析开关 | 增加「运行污点分析」复选框 | server 传参 |
| 1.2 | Source 数目 | 在摘要区显示 Source 总数 | taintAnalysis.statistics.sourceCount |
| 1.3 | Sink 数目 | 在摘要区显示 Sink 总数 | taintAnalysis.statistics.sinkCount |
| 1.4 | 资源泄漏数 | 在摘要区显示资源泄漏数 | taintAnalysis.resourceLeaks.length |
| 1.5 | 污点泄漏数 | 在摘要区显示污点泄漏数 | taintAnalysis.taintLeaks.length |
| 1.6 | IFDS 统计 | 分析方法数、事实数、耗时 | taintAnalysis.statistics |

### Phase 2：Source/Sink 位置展示（优先级：高）

| 序号 | 功能 | 说明 | 实现方式 |
|------|------|------|----------|
| 2.1 | Source 列表与位置 | 表格：资源类型、方法签名、文件路径、行号、列号 | 新增 API：扫描 Scene 中所有匹配 Source 的调用，提取位置 |
| 2.2 | Sink 列表与位置 | 同上 | 同上 |
| 2.3 | 可点击跳转 | 行号支持打开 IDE 或复制路径+行号 | 前端：生成 vscode://file/... 或 path:line 格式 |

### Phase 3：泄漏详情与定位（优先级：高）

| 序号 | 功能 | 说明 | 实现方式 |
|------|------|------|----------|
| 3.1 | 资源泄漏列表 | 表格：资源类型、描述、Source 位置、预期 Sink | ResourceLeak 已有 sourceStmt、resourceType、expectedSink |
| 3.2 | 泄漏 Source 位置 | 文件路径、行号、列号 | 从 sourceStmt.getOriginPositionInfo() 提取 |
| 3.3 | 污点泄漏列表 | Source→Sink 路径摘要 | TaintLeak 含 sourceStmt、sinkStmt |
| 3.4 | 泄漏严重程度标签 | 按 resource/memory/closure 分类展示 | ResourceLeak 含 source.category |

### Phase 4：有界约束配置（优先级：中）

| 序号 | 功能 | 说明 | 实现方式 |
|------|------|------|----------|
| 4.1 | 约束配置面板 | 可输入 maxCallbackIterations、maxAbilitiesPerFlow、maxNavigationHops | 前端表单，随 analyze 请求发送 |
| 4.2 | 当前约束显示 | 分析完成后展示实际使用的约束值 | 结果中返回 bounds |

### Phase 5：可视化增强（优先级：中）

| 序号 | 功能 | 说明 | 实现方式 |
|------|------|------|----------|
| 5.1 | 新增 Tab：Source/Sink | 单独标签页展示 Source、Sink 列表及位置 | 复用现有 Tab 结构 |
| 5.2 | 新增 Tab：泄漏详情 | 资源泄漏、污点泄漏分开展示 | 同上 |
| 5.3 | 新增 Tab：有界约束 | 约束配置与统计 | 同上 |
| 5.4 | 导出报告含污点信息 | JSON/Text/HTML/Markdown 增加 Source/Sink、泄漏详情 | ReportGenerator 扩展 |

### Phase 6：体验优化（优先级：低）

| 序号 | 功能 | 说明 |
|------|------|------|
| 6.1 | 分析进度反馈 | 大项目分析时显示阶段进度（Scene→DummyMain→IFDS） |
| 6.2 | 错误信息展示 | 分析失败时展示具体错误堆栈 |
| 6.3 | 历史项目 | 本地存储最近分析过的路径列表 |
| 6.4 | 深色模式 | 可选主题切换 |

---

## 四、实现顺序与流程计划

### 阶段一：后端扩展（约 2–3 天）

```
1. server.ts：handleAnalyze 增加 options.runTaintAnalysis、options.bounds
2. LifecycleAnalyzer：确保返回 taintAnalysis（已有，仅需确保 options 传入）
3. 新增 API：/api/analyze 或扩展现有，返回：
   - summary 中增加 sourceCount、sinkCount、resourceLeakCount、taintLeakCount
   - taintAnalysis 完整对象（resourceLeaks、taintLeaks、statistics）
4. 新增 Source/Sink 位置扫描：
   - 在 LifecycleAnalyzer 或新建 SourceSinkLocationScanner
   - 遍历 scene.getMethods() → cfg.getStmts() → 调用 SourceSinkManager.isSource/isSink
   - 对匹配的 Stmt 提取：getCfg().getDeclaringMethod().getDeclaringArkFile().getFilePath()、getOriginPositionInfo()
   - 返回 Array<{ type: 'source'|'sink', resourceType, methodSig, filePath, line, col }>
5. AnalysisResult 扩展：
   - sourceLocations: SourceLocation[]
   - sinkLocations: SinkLocation[]
```

### 阶段二：前端基础展示（约 2 天）

```
1. 分析选项区：增加「运行污点分析」 checkbox（默认勾选）
2. 摘要区 summary-grid：增加 Source 数、Sink 数、资源泄漏数、污点泄漏数、IFDS 方法数、IFDS 事实数
3. 新增 Tab：「Source/Sink」「泄漏详情」「有界约束」
4. Source/Sink Tab：两张表（Source 表、Sink 表），列：类型、方法签名、文件、行、列
5. 泄漏详情 Tab：
   - 资源泄漏表：类型、描述、Source 位置（文件:行）、预期 Sink
   - 污点泄漏表：Source→Sink 路径摘要
```

### 阶段三：位置可点击与约束配置（约 1–2 天）

```
1. 位置列：渲染为可点击链接，格式 filePath:line:col 或 vscode://file/absolutePath:line
2. 有界约束：在选项区增加「高级选项」折叠区，包含：
   - maxCallbackIterations（数字输入，默认 1）
   - maxAbilitiesPerFlow（默认 3）
   - maxNavigationHops（默认 5）
3. 分析请求 body 传递 bounds
4. 结果区展示「本次使用的约束」
```

### 阶段四：报告与体验（约 1 天）

```
1. ReportGenerator：扩展 generateText/generateHTML/generateMarkdown，增加：
   - Source/Sink 统计与列表（含位置）
   - 资源泄漏、污点泄漏详情
2. 前端：分析中大项目时显示阶段提示（可选 WebSocket 或轮询 /api/status）
3. 错误展示：分析失败时在 statusBar 下方展开错误详情
```

---

## 五、数据流示意

```
用户输入项目路径
       ↓
[前端] 点击「开始分析」→ POST /api/analyze { projectPath, options: { runTaintAnalysis, bounds } }
       ↓
[后端] LifecycleAnalyzer.analyze(projectPath)
       ├── Scene 构建
       ├── Ability/Component 收集
       ├── UI 回调提取
       ├── 导航分析
       ├── DummyMain 生成
       ├── [可选] 污点分析 runFromDummyMain()
       └── [新增] SourceSinkLocationScanner.scan(scene) → sourceLocations, sinkLocations
       ↓
[后端] 返回 AnalysisResult（含 taintAnalysis、sourceLocations、sinkLocations）
       ↓
[前端] displayResults()
       ├── 摘要区：Source、Sink、泄漏数、IFDS 统计
       ├── Tab Source/Sink：两张表 + 位置
       ├── Tab 泄漏详情：资源泄漏、污点泄漏
       └── Tab 有界约束：配置回显
```

---

## 六、接口约定（扩展）

### 6.1 POST /api/analyze 请求体扩展

```json
{
  "projectPath": "C:\\Projects\\MyApp",
  "options": {
    "inferTypes": true,
    "generateDummyMain": true,
    "analyzeNavigation": true,
    "extractUICallbacks": true,
    "runTaintAnalysis": true,
    "bounds": {
      "maxCallbackIterations": 1,
      "maxAbilitiesPerFlow": 3,
      "maxNavigationHops": 5
    }
  }
}
```

### 6.2 响应扩展（result 新增字段）

```typescript
// 摘要扩展
summary: {
  // ... 原有字段
  sourceCount: number;
  sinkCount: number;
  resourceLeakCount: number;
  taintLeakCount: number;
}

// 污点分析结果（runTaintAnalysis=true 时）
taintAnalysis?: {
  entryMethod: string;
  resourceLeaks: ResourceLeak[];
  taintLeaks: TaintLeak[];
  statistics: { analyzedMethods, totalFacts, sourceCount, sinkCount, duration };
}

// 新增：Source/Sink 位置列表
sourceLocations?: Array<{ resourceType, methodSig, filePath, line, col }>;
sinkLocations?: Array<{ resourceType, methodSig, filePath, line, col }>;
```

### 6.3 ResourceLeak 位置序列化

```typescript
// 序列化时需将 sourceStmt 转为可传输的位置信息
interface ResourceLeakDTO {
  resourceType: string;
  expectedSink: string;
  description: string;
  sourceLocation: { filePath: string; line: number; col: number; methodSig: string };
}
```

---

## 七、预估工时与里程碑

| 阶段 | 内容 | 预估工时 | 里程碑 |
|------|------|----------|--------|
| 阶段一 | 后端：污点分析接入、Source/Sink 位置扫描 | 2–3 天 | 接口返回完整污点数据与位置 |
| 阶段二 | 前端：摘要扩展、Source/Sink Tab、泄漏 Tab | 2 天 | 关键信息可视 |
| 阶段三 | 位置可点击、有界约束配置 | 1–2 天 | 配置与定位完善 |
| 阶段四 | 报告扩展、错误展示、体验 | 1 天 | 报告与体验收尾 |

**总计**：约 6–8 个工作日。

---

## 八、实施优先级建议

1. **P0（必做）**：Phase 1 + Phase 2 核心（Source/Sink 数目、泄漏数、Source/Sink 列表含位置、泄漏详情含位置）
2. **P1（重要）**：Phase 3（位置可点击、有界约束配置）
3. **P2（可选）**：Phase 5.4 报告扩展、Phase 6 体验优化

按上述顺序实现，可优先满足计划书中的关键信息展示需求。
