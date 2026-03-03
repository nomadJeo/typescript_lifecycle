# HarmonyOS 生命周期分析工具 - GUI 界面

## 快速启动

在项目根目录执行以下命令启动 GUI 服务：

```bash
cd arkanalyzer-master/arkanalyzer-master
npx ts-node --transpile-only src/TEST_lifecycle/gui/start.ts
```

启动成功后，打开浏览器访问：

**http://localhost:3000**

## 功能说明

### 1. 项目分析

1. 在输入框中输入 HarmonyOS 项目路径
2. 选择需要的分析选项：
   - **类型推断**: 推断变量和表达式的类型
   - **生成 DummyMain**: 生成用于静态分析的虚拟入口函数
   - **导航分析**: 分析页面跳转关系
   - **UI 回调提取**: 提取 onClick、onChange 等 UI 事件回调
3. 点击 "开始分析" 按钮

### 2. 查看结果

分析完成后，可以查看：

- **统计摘要**: 文件数、类数、Ability/Component 数量等
- **Ability 列表**: 所有 Ability 及其生命周期方法
- **Component 列表**: 所有 Component 及其信息
- **UI 回调**: 按事件类型统计的 UI 回调
- **导航关系**: 页面跳转关系
- **耗时统计**: 各分析阶段的耗时

### 3. 导出报告

支持导出多种格式的报告：

- **JSON**: 完整的结构化数据
- **Text**: 纯文本格式
- **HTML**: 美观的 HTML 报告
- **Markdown**: 适合文档的 Markdown 格式

## 示例项目路径

```
# RingtoneKit 项目
C:\Users\kemomimi\Desktop\typescript\Demo4tests\RingtoneKit_Codelab_Demo\RingtoneKit_Codelab_Demo\RingtoneKit_Codelab_Demo\entry

# OxHornCampus 项目
C:\Users\kemomimi\Desktop\typescript\Demo4tests\OxHornCampus\OxHornCampus\entry

# 内置测试项目
C:\Users\kemomimi\Desktop\typescript\arkanalyzer-master\arkanalyzer-master\tests\resources\lifecycle\simple
```

## 技术架构

```
┌─────────────────────────────────────────────┐
│           浏览器 (index.html)                │
│   ┌─────────────────────────────────────┐   │
│   │        用户界面 (HTML/CSS/JS)        │   │
│   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    │ HTTP
                    ▼
┌─────────────────────────────────────────────┐
│           Node.js 服务 (server.ts)           │
│   ┌─────────────────────────────────────┐   │
│   │    /api/analyze - 项目分析           │   │
│   │    /api/report  - 报告生成           │   │
│   │    /api/validate - 路径验证          │   │
│   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────┐
│          CLI 核心 (LifecycleAnalyzer)        │
│   ┌─────────────────────────────────────┐   │
│   │  AbilityCollector                   │   │
│   │  ViewTreeCallbackExtractor          │   │
│   │  NavigationAnalyzer                 │   │
│   │  LifecycleModelCreator              │   │
│   └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

## API 接口

### POST /api/analyze

分析 HarmonyOS 项目。

**请求体:**
```json
{
    "projectPath": "C:/path/to/project",
    "options": {
        "inferTypes": true,
        "generateDummyMain": true,
        "analyzeNavigation": true,
        "extractUICallbacks": true
    }
}
```

**响应:**
```json
{
    "success": true,
    "result": { /* AnalysisResult */ }
}
```

### POST /api/report

生成分析报告。

**请求体:**
```json
{
    "result": { /* AnalysisResult */ },
    "format": "html",
    "title": "报告标题"
}
```

**响应:**
```json
{
    "success": true,
    "report": "..."
}
```

### GET /api/validate

验证项目路径。

**参数:** `?path=C:/path/to/project`

**响应:**
```json
{
    "valid": true,
    "exists": true,
    "isDirectory": true,
    "hasModuleJson": true,
    "hasEtsFiles": true,
    "message": "有效的 HarmonyOS 项目路径"
}
```

## 常见问题

### Q: 服务启动失败？

确保已安装依赖：
```bash
npm install
```

### Q: 分析很慢？

大型项目分析可能需要较长时间，这是正常的。可以尝试：
- 只分析 entry 目录而非整个项目
- 关闭不需要的分析选项

### Q: 找不到 Ability/Component？

确保输入的是正确的 HarmonyOS 项目路径，路径应包含 `module.json5` 文件。

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0.0 | 2025-03-01 | 初始版本 |
