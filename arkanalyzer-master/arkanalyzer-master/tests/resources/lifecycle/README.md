# TEST_lifecycle 测试资源与测试结果

## 📊 测试结果总览

```
 Test Files  5 passed (5)
      Tests  90 passed (90)
   Duration  ~25s
```

**最后测试时间**: 2025-03-01
**测试覆盖率估算**: ~75%

---

## 🌟 v1.0.0 新增：真实项目验证

### 测试项目概览

| 项目 | 描述 | 规模 | 测试文件 | 状态 |
|------|------|------|----------|:----:|
| **RingtoneKit_Codelab_Demo** | 铃声服务 Codelab | 小型 (2 文件) | `RingtoneKitAnalysis.test.ts` | ✅ |
| **UIDesignKit_HdsNavigation_Codelab** | 高端导航栏组件 | 中型 (6 文件) | `UIDesignKitNavAnalysis.test.ts` | ✅ |
| **CloudFoundationKit_Codelab_Prefetch_ArkTS** | 云开发预加载服务 | 中型 (5 文件) | `CloudFoundationKitAnalysis.test.ts` | ✅ |
| **OxHornCampus** | 溪村小镇展示应用 | 大型 (35 文件) | `OxHornCampusAnalysis.test.ts` | ✅ |

### 详细测试结果

#### 1. RingtoneKit_Codelab_Demo (小型项目)

| 指标 | 结果 |
|------|------|
| **测试用例** | 11/11 通过 |
| **Ability** | 1 (EntryAbility) |
| **Component** | 1 (Index) |
| **生命周期方法** | 7 |
| **UI 回调** | 2 (onClick, onChange) |
| **特点** | 验证基础功能、onChange 事件支持 |

#### 2. UIDesignKit_HdsNavigation_Codelab (中型项目)

| 指标 | 结果 |
|------|------|
| **测试用例** | 12/12 通过 |
| **Ability** | 2 (EntryAbility, EntryBackupAbility) |
| **Component** | 3 (Index, PageOne, PageTwo) |
| **生命周期方法** | 9 |
| **UI 回调** | 0* |
| **特点** | 发现第三方 UI 框架 (HdsNavigation) ViewTree 解析限制 |

> *第三方 UI 组件导致 ViewTree 为空，这是 ArkAnalyzer 的固有限制

#### 3. CloudFoundationKit_Codelab_Prefetch_ArkTS (中型项目)

| 指标 | 结果 |
|------|------|
| **测试用例** | 12/12 通过 |
| **Ability** | 1 (EntryAbility) |
| **Component** | 3 (Index, CloudResPrefetch, CloudResPeriodicPrefetch) |
| **生命周期方法** | 9 |
| **UI 回调** | 8 (全部为 onClick) |
| **特点** | 验证 module.json5 修复、标准 ArkUI 组件 |

#### 4. OxHornCampus (大型项目) ⭐

| 指标 | 结果 |
|------|------|
| **测试用例** | 12/12 通过 |
| **Ability** | 2 (EntryAbility, EntryFormAbility) |
| **Component** | 17 |
| **生命周期方法** | 32 |
| **UI 回调** | 30 (onClick: 20, onChange: 5, onSubmit: 3, onAreaChange: 2) |
| **Scene 构建时间** | 911ms |
| **特点** | 大规模项目压力测试、丰富的事件类型、aboutToAppear/aboutToDisappear 生命周期 |

### 关键发现与修复

#### 修复 1: JSON5 解析问题

**问题**: module.json5 文件中的尾随逗号导致解析失败

**修复**: 在 `AbilityCollector.ts` 中增强 JSON5 -> JSON 转换
```typescript
const jsonContent = content
    .replace(/\/\/.*$/gm, '')           // 移除单行注释
    .replace(/\/\*[\s\S]*?\*\//g, '')   // 移除多行注释
    .replace(/,(\s*[\]}])/g, '$1')      // 移除尾随逗号
    .replace(/'/g, '"');                // 单引号转双引号
```

#### 修复 2: 新增 UI 事件类型

**新增支持**: `onChange`, `onSelect`, `onSubmit`, `onScroll`

**修改文件**: 
- `ViewTreeCallbackExtractor.ts` - 添加事件方法识别
- `LifecycleTypes.ts` - 添加事件类型枚举

#### 发现的限制

| 限制 | 说明 | 影响 |
|------|------|------|
| **第三方 UI 组件** | HdsNavigation 等组件无法解析 ViewTree | 仅影响使用特定 UI 框架的项目 |
| **NavPathStack 导航** | pushPath/pushPathByName 新 API 未支持 | 不影响传统 router 导航 |
| **动态 loadContent 目标** | 变量形式的目标页面无法静态解析 | 不影响常量形式的页面加载 |

---

## 🗂️ 目录结构

```
lifecycle/
├── simple/                    # 简单项目（基础测试）
│   ├── EntryAbility.ets      # 单个 Ability
│   ├── Index.ets             # 单个 Component（含 onClick）
│   └── module.json5          # 模块配置
│
├── multi-ability/            # 多 Ability 项目
│   ├── EntryAbility.ets      # 入口 Ability（含 startAbility）
│   ├── SecondAbility.ets     # 第二个 Ability
│   └── module.json5          # 多 Ability 配置
│
├── router/                   # 路由测试项目
│   ├── Index.ets             # 含多种路由跳转方式
│   └── Detail.ets            # 目标页面
│
├── complex-ui/               # 复杂 UI 场景
│   ├── HomePage.ets          # 多事件类型、嵌套组件
│   ├── DetailPage.ets        # 路由参数传递
│   └── module.json5
│
└── edge-cases/               # 边界情况测试
    ├── EmptyComponent.ets    # 空组件（无回调）
    ├── NoViewTreeComponent.ets # 极简组件
    └── MinimalAbility.ets    # 最小化 Ability
```

---

## ✅ 测试用例详情

### Level 1: 单元测试

#### 1.1 AbilityCollector 基础功能

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 收集 Ability | ✅ | 收集到 1 个 Ability (EntryAbility) |
| 收集 Component | ✅ | 收集到 1 个 Component (Index) |
| Ability 生命周期方法识别 | ✅ | onCreate, onWindowStageCreate 等 |
| Component 生命周期方法识别 | ✅ | aboutToAppear, build 等 |

#### 1.2 入口 Ability 识别

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 识别入口 Ability | ✅ | 正确识别 EntryAbility 为入口 |
| module.json5 配置读取 | ✅ | 读取 mainElement: "EntryAbility" |

#### 1.3 ViewTreeCallbackExtractor

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 从 Component 提取回调 | ✅ | 提取到 2 个回调 |
| 解析 onClick 回调 | ✅ | handleClick, %AM0$build |

#### 1.4 NavigationAnalyzer

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 分析 router.pushUrl | ✅ | 识别 goToDetail1, goToDetail2, goToSettings |
| 路由 URL 提取 | ✅ | 提取 pages/Index 等 |
| 对象字面量 URL 解析 | ✅ | 从匿名类字段提取 (v0.7.0 新增) |
| 变量形式 URL 解析 | ✅ | 追踪 Local 变量定义 (v0.7.0 增强) |

### Level 2: 集成测试

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 收集器 + 回调提取器集成 | ✅ | Component 回调正确填充 |
| 收集器 + 导航分析器集成 | ✅ | 分析 Ability 间跳转关系 |

### Level 3: 端到端测试

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 创建 DummyMain | ✅ | 成功创建扩展版 DummyMain |
| DummyMain 包含 CFG | ✅ | CFG 包含 7 个基本块 |
| 正确数量的 Ability/Component | ✅ | 1 Ability + 1 Component |
| 多 Ability 处理 | ✅ | 成功处理 2 个 Ability |

### Level 4: 复杂 UI 场景测试

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 多种 UI 事件类型识别 | ✅ | onClick, onTouch 等 |
| 嵌套组件处理 | ✅ | 父子组件正确识别 |
| 方法引用和箭头函数回调 | ✅ | 两种形式均支持 |

### Level 5: 边界情况测试

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 空组件处理 | ✅ | 无回调组件正常处理 |
| 最小化 Ability | ✅ | 只有 onCreate 的 Ability |

### Level 6: DummyMain 结构验证

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| CFG 包含基本块 | ✅ | 7 个基本块 |
| 生命周期调用语句 | ✅ | 13 个 invoke 语句 |
| 参数生成验证 | ✅ | onCreate(%param1, %param2) |
| Ability-Component 关联 | ✅ | 正确建立关联 |

### Level 7: 性能基准测试

| 测试项 | 状态 | 说明 |
|--------|:----:|------|
| 处理时间 | ✅ | simple 项目 246ms (< 5s) |

---

## 🔍 测试输出关键信息

### simple 项目分析结果

```
========== LifecycleModelCreator Summary ==========
Abilities: 1
  - EntryAbility (5 lifecycle methods)
Components: 1
  - Index (2 UI callbacks)
DummyMain: @simple/@extendedDummyFile: @extendedDummyClass.@extendedDummyMain()
===================================================
```

### 类结构解析结果

```
类: EntryAbility
  继承: UIAbility
  方法: onCreate, onWindowStageCreate, onForeground, onBackground, onDestroy

类: Index
  继承: CustomComponent
  方法: constructor, aboutToAppear, aboutToDisappear, handleClick, build
  ViewTree: 存在
```

---

## ⚠️ 已知警告

```
[AbilityCollector] Warning: 无法解析 startAbility 的目标 Ability (startSecondAbility)
```

**原因**: Want 对象的 abilityName 字段提取在某些复杂场景下尚需优化。

**影响**: 不影响核心功能，仅影响跨 Ability 跳转目标的精确识别。

---

## 🚀 运行测试

```bash
# 进入项目目录
cd arkanalyzer-master/arkanalyzer-master

# 安装依赖（首次需要）
npm install

# 运行 lifecycle 测试
npx vitest run tests/unit/lifecycle/ --reporter=verbose
```

---

## 📁 测试资源说明

### simple/ - 基础功能测试
- **EntryAbility.ets**: 包含完整生命周期方法的 Ability
- **Index.ets**: 带 onClick 回调的 Component
- **module.json5**: 定义 mainElement 为 EntryAbility

### multi-ability/ - 多 Ability 测试
- **EntryAbility.ets**: 包含 startAbility 跳转到 SecondAbility
- **SecondAbility.ets**: 第二个 Ability
- **module.json5**: 定义多个 abilities

### router/ - 路由分析测试
- **Index.ets**: 包含多种路由调用方式
  - `router.pushUrl({ url: 'pages/Detail' })` - 直接参数
  - `router.pushUrl(options)` - 变量参数
  - `router.replaceUrl()` - 替换式跳转
  - `router.back()` - 返回
- **Detail.ets**: 路由目标页面
- **DynamicRouter.ets**: 动态路由参数场景测试 (v0.7.0 新增)
  - 对象字面量 URL
  - 分步赋值 URL
  - 字符串拼接 URL
  - 条件选择 URL
  - 函数返回值 URL

---

## 🔬 动态路由参数解析 (v0.7.0+)

### 解析能力

| 场景 | 示例代码 | 解析结果 |
|------|---------|:--------:|
| 直接字面量 | `router.pushUrl({ url: 'pages/Page1' })` | ✅ |
| 变量形式 | `let opt = { url: 'xxx' }; router.pushUrl(opt)` | ✅ |
| 字符串拼接 | `router.pushUrl({ url: 'pages/' + name })` | ⚠️ 前缀 |
| 成员变量 | `router.pushUrl({ url: this.memberVar })` | ❌ |
| 条件选择 | `router.pushUrl({ url: isA ? 'x' : 'y' })` | ❌ |
| 函数返回值 | `router.pushUrl({ url: getUrl() })` | ❌ |

### 技术原理

对象字面量 `{ url: 'pages/xxx' }` 被 ArkAnalyzer 转换为匿名类：
```
%0 = new %AC1$DynamicRouter.goToPage1
```

URL 值存储在匿名类的字段初始值中：
```
类: %AC1$DynamicRouter.goToPage1
字段: url: string
初始值: this.url = 'pages/Page1'
```

`extractUrlFromAnonymousClass()` 方法从这些字段中提取 URL 值。

---

## 🏗️ 真实项目分析架构

### 测试文件组织

```
tests/unit/lifecycle/
├── LifecycleModelCreator.test.ts     # 核心功能测试 (27 用例)
├── RingtoneKitAnalysis.test.ts       # 真实项目: 小型 (11 用例)
├── UIDesignKitNavAnalysis.test.ts    # 真实项目: 中型 (12 用例)
├── CloudFoundationKitAnalysis.test.ts # 真实项目: 中型 (12 用例)
└── OxHornCampusAnalysis.test.ts      # 真实项目: 大型 (12 用例)
```

### 真实项目测试用例结构

每个真实项目测试文件包含以下标准测试套件：

```typescript
describe('项目名 - TEST_lifecycle 分析', () => {
    // 1. 项目规模分析
    test('项目规模 - 类和文件统计');
    
    // 2. module.json5 解析
    test('module.json5 解析 - 入口 Ability 识别');
    
    // 3. Ability 收集
    test('Ability 收集 - 数量和生命周期方法');
    
    // 4. Component 收集  
    test('Component 收集 - 数量和生命周期方法');
    
    // 5. UI 回调提取
    test('UI 回调提取 - 事件类型和分布');
    
    // 6. 导航分析
    test('导航分析 - 路由和页面跳转');
    
    // 7. DummyMain 生成
    test('DummyMain 生成 - CFG 结构验证');
});
```

### 运行特定项目测试

```bash
# 运行所有 lifecycle 测试
npx vitest run tests/unit/lifecycle/ --reporter=verbose

# 运行单个项目测试
npx vitest run tests/unit/lifecycle/OxHornCampusAnalysis.test.ts

# 运行并输出详细日志
DEBUG=* npx vitest run tests/unit/lifecycle/RingtoneKitAnalysis.test.ts
```
