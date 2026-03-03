/*
 * Copyright (c) 2024-2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file cli/ReportGenerator.ts
 * @description 报告生成器 - 支持多种输出格式
 */

import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult } from './LifecycleAnalyzer';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 报告格式
 */
export type ReportFormat = 'json' | 'text' | 'html' | 'markdown';

/**
 * 报告选项
 */
export interface ReportOptions {
    /** 输出格式 */
    format: ReportFormat;
    /** 输出路径（可选，不提供则返回字符串） */
    outputPath?: string;
    /** 是否包含详细信息 */
    detailed?: boolean;
    /** 报告标题 */
    title?: string;
}

// ============================================================================
// ReportGenerator 类
// ============================================================================

/**
 * 报告生成器
 */
export class ReportGenerator {
    /**
     * 生成报告
     * @param result 分析结果
     * @param options 报告选项
     * @returns 报告内容（如果未指定输出路径）
     */
    generate(result: AnalysisResult, options: ReportOptions): string {
        let content: string;

        switch (options.format) {
            case 'json':
                content = this.generateJSON(result, options);
                break;
            case 'text':
                content = this.generateText(result, options);
                break;
            case 'html':
                content = this.generateHTML(result, options);
                break;
            case 'markdown':
                content = this.generateMarkdown(result, options);
                break;
            default:
                throw new Error(`不支持的报告格式: ${options.format}`);
        }

        if (options.outputPath) {
            const dir = path.dirname(options.outputPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(options.outputPath, content, 'utf-8');
        }

        return content;
    }

    /**
     * 生成 JSON 格式报告
     */
    private generateJSON(result: AnalysisResult, options: ReportOptions): string {
        return JSON.stringify(result, null, 2);
    }

    /**
     * 生成文本格式报告
     */
    private generateText(result: AnalysisResult, options: ReportOptions): string {
        const lines: string[] = [];
        const title = options.title || 'HarmonyOS 生命周期分析报告';
        
        lines.push('='.repeat(60));
        lines.push(title);
        lines.push('='.repeat(60));
        lines.push('');
        
        // 项目信息
        lines.push('【项目信息】');
        lines.push(`  路径: ${result.project.path}`);
        lines.push(`  名称: ${result.project.name}`);
        lines.push(`  分析时间: ${result.project.analyzedAt}`);
        lines.push('');
        
        // 统计摘要
        lines.push('【统计摘要】');
        lines.push(`  文件数量: ${result.summary.totalFiles}`);
        lines.push(`  类数量: ${result.summary.totalClasses}`);
        lines.push(`  Ability 数量: ${result.summary.abilityCount}`);
        lines.push(`  Component 数量: ${result.summary.componentCount}`);
        lines.push(`  生命周期方法: ${result.summary.lifecycleMethodCount}`);
        lines.push(`  UI 回调: ${result.summary.uiCallbackCount}`);
        lines.push(`  导航关系: ${result.summary.navigationCount}`);
        lines.push('');
        
        // Ability 列表
        lines.push('【Ability 列表】');
        for (const ability of result.abilities) {
            const entryMark = ability.isEntry ? ' [入口]' : '';
            lines.push(`  • ${ability.name}${entryMark}`);
            lines.push(`    类名: ${ability.className}`);
            lines.push(`    生命周期: ${ability.lifecycleMethods.join(', ')}`);
            if (options.detailed) {
                lines.push(`    文件: ${ability.filePath}`);
            }
        }
        lines.push('');
        
        // Component 列表
        lines.push('【Component 列表】');
        for (const component of result.components) {
            lines.push(`  • ${component.name}`);
            lines.push(`    类名: ${component.className}`);
            lines.push(`    生命周期: ${component.lifecycleMethods.join(', ')}`);
            lines.push(`    UI 回调: ${component.uiCallbacks.length} 个`);
            if (options.detailed && component.uiCallbacks.length > 0) {
                for (const cb of component.uiCallbacks) {
                    lines.push(`      - ${cb.eventType}: ${cb.methodName}`);
                }
            }
        }
        lines.push('');
        
        // UI 回调统计
        if (Object.keys(result.uiCallbacksByType).length > 0) {
            lines.push('【UI 回调统计】');
            for (const [type, count] of Object.entries(result.uiCallbacksByType)) {
                lines.push(`  ${type}: ${count}`);
            }
            lines.push('');
        }
        
        // 导航关系
        if (result.navigations.length > 0) {
            lines.push('【导航关系】');
            for (const nav of result.navigations) {
                lines.push(`  ${nav.source} → ${nav.target} (${nav.type})`);
            }
            lines.push('');
        }
        
        // DummyMain 信息
        if (result.dummyMain) {
            lines.push('【DummyMain 信息】');
            lines.push(`  方法签名: ${result.dummyMain.methodSignature}`);
            lines.push(`  基本块数: ${result.dummyMain.blockCount}`);
            lines.push(`  语句数: ${result.dummyMain.stmtCount}`);
            lines.push(`  生命周期调用: ${result.dummyMain.lifecycleCallCount}`);
            lines.push(`  UI 回调调用: ${result.dummyMain.uiCallbackCount}`);
            lines.push('');
        }
        
        // 耗时统计
        lines.push('【耗时统计】');
        lines.push(`  Scene 构建: ${result.duration.sceneBuilding}ms`);
        lines.push(`  Ability 收集: ${result.duration.abilityCollection}ms`);
        lines.push(`  Component 收集: ${result.duration.componentCollection}ms`);
        lines.push(`  UI 回调提取: ${result.duration.uiCallbackExtraction}ms`);
        lines.push(`  导航分析: ${result.duration.navigationAnalysis}ms`);
        lines.push(`  DummyMain 生成: ${result.duration.dummyMainGeneration}ms`);
        lines.push(`  总耗时: ${result.duration.total}ms`);
        lines.push('');
        
        // 警告和错误
        if (result.warnings.length > 0) {
            lines.push('【警告】');
            for (const warning of result.warnings) {
                lines.push(`  ⚠ ${warning}`);
            }
            lines.push('');
        }
        
        if (result.errors.length > 0) {
            lines.push('【错误】');
            for (const error of result.errors) {
                lines.push(`  ✗ ${error}`);
            }
            lines.push('');
        }
        
        lines.push('='.repeat(60));
        lines.push('报告生成完毕');
        lines.push('='.repeat(60));
        
        return lines.join('\n');
    }

    /**
     * 生成 HTML 格式报告
     */
    private generateHTML(result: AnalysisResult, options: ReportOptions): string {
        const title = options.title || 'HarmonyOS 生命周期分析报告';
        
        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { 
            text-align: center; 
            color: #2c3e50;
            margin-bottom: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 10px;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .card h2 {
            color: #2c3e50;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 15px;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .stat-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
        }
        tr:hover { background: #f8f9fa; }
        .tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.85em;
            margin: 2px;
        }
        .tag-entry { background: #d4edda; color: #155724; }
        .tag-lifecycle { background: #cce5ff; color: #004085; }
        .tag-callback { background: #fff3cd; color: #856404; }
        .tag-nav { background: #f8d7da; color: #721c24; }
        .progress-bar {
            height: 8px;
            background: #e9ecef;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }
        .warning { color: #856404; background: #fff3cd; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .error { color: #721c24; background: #f8d7da; padding: 10px; border-radius: 4px; margin: 5px 0; }
        .footer {
            text-align: center;
            color: #666;
            padding: 20px;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        
        <!-- 项目信息 -->
        <div class="card">
            <h2>📁 项目信息</h2>
            <p><strong>路径:</strong> ${result.project.path}</p>
            <p><strong>名称:</strong> ${result.project.name}</p>
            <p><strong>分析时间:</strong> ${result.project.analyzedAt}</p>
        </div>
        
        <!-- 统计摘要 -->
        <div class="card">
            <h2>📊 统计摘要</h2>
            <div class="summary-grid">
                <div class="stat-item">
                    <div class="stat-value">${result.summary.totalFiles}</div>
                    <div class="stat-label">文件</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.summary.totalClasses}</div>
                    <div class="stat-label">类</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.summary.abilityCount}</div>
                    <div class="stat-label">Ability</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.summary.componentCount}</div>
                    <div class="stat-label">Component</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.summary.lifecycleMethodCount}</div>
                    <div class="stat-label">生命周期方法</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.summary.uiCallbackCount}</div>
                    <div class="stat-label">UI 回调</div>
                </div>
            </div>
        </div>
        
        <!-- Ability 列表 -->
        <div class="card">
            <h2>🎯 Ability 列表</h2>
            <table>
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>类名</th>
                        <th>生命周期方法</th>
                        <th>入口</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.abilities.map(a => `
                    <tr>
                        <td>${a.name}</td>
                        <td>${a.className}</td>
                        <td>${a.lifecycleMethods.map(m => `<span class="tag tag-lifecycle">${m}</span>`).join('')}</td>
                        <td>${a.isEntry ? '<span class="tag tag-entry">入口</span>' : '-'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- Component 列表 -->
        <div class="card">
            <h2>🧩 Component 列表</h2>
            <table>
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>类名</th>
                        <th>生命周期方法</th>
                        <th>UI 回调</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.components.map(c => `
                    <tr>
                        <td>${c.name}</td>
                        <td>${c.className}</td>
                        <td>${c.lifecycleMethods.map(m => `<span class="tag tag-lifecycle">${m}</span>`).join('')}</td>
                        <td>${c.uiCallbacks.length > 0 ? 
                            c.uiCallbacks.map(cb => `<span class="tag tag-callback">${cb.eventType}</span>`).join('') : 
                            '-'}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <!-- UI 回调统计 -->
        ${Object.keys(result.uiCallbacksByType).length > 0 ? `
        <div class="card">
            <h2>👆 UI 回调分布</h2>
            ${Object.entries(result.uiCallbacksByType).map(([type, count]) => {
                const total = result.summary.uiCallbackCount;
                const percent = total > 0 ? (count / total * 100).toFixed(1) : 0;
                return `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between;">
                        <span>${type}</span>
                        <span>${count} (${percent}%)</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
        ` : ''}
        
        <!-- 导航关系 -->
        ${result.navigations.length > 0 ? `
        <div class="card">
            <h2>🔗 导航关系</h2>
            <table>
                <thead>
                    <tr>
                        <th>来源</th>
                        <th>目标</th>
                        <th>类型</th>
                    </tr>
                </thead>
                <tbody>
                    ${result.navigations.map(n => `
                    <tr>
                        <td>${n.source}</td>
                        <td>${n.target}</td>
                        <td><span class="tag tag-nav">${n.type}</span></td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <!-- DummyMain 信息 -->
        ${result.dummyMain ? `
        <div class="card">
            <h2>🔧 DummyMain 信息</h2>
            <div class="summary-grid">
                <div class="stat-item">
                    <div class="stat-value">${result.dummyMain.blockCount}</div>
                    <div class="stat-label">基本块</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.dummyMain.stmtCount}</div>
                    <div class="stat-label">语句</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.dummyMain.lifecycleCallCount}</div>
                    <div class="stat-label">生命周期调用</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${result.dummyMain.uiCallbackCount}</div>
                    <div class="stat-label">UI 回调调用</div>
                </div>
            </div>
        </div>
        ` : ''}
        
        <!-- 耗时统计 -->
        <div class="card">
            <h2>⏱️ 耗时统计</h2>
            <table>
                <tbody>
                    <tr><td>Scene 构建</td><td>${result.duration.sceneBuilding}ms</td></tr>
                    <tr><td>Ability 收集</td><td>${result.duration.abilityCollection}ms</td></tr>
                    <tr><td>Component 收集</td><td>${result.duration.componentCollection}ms</td></tr>
                    <tr><td>UI 回调提取</td><td>${result.duration.uiCallbackExtraction}ms</td></tr>
                    <tr><td>导航分析</td><td>${result.duration.navigationAnalysis}ms</td></tr>
                    <tr><td>DummyMain 生成</td><td>${result.duration.dummyMainGeneration}ms</td></tr>
                    <tr style="font-weight: bold;"><td>总耗时</td><td>${result.duration.total}ms</td></tr>
                </tbody>
            </table>
        </div>
        
        <!-- 警告和错误 -->
        ${result.warnings.length > 0 || result.errors.length > 0 ? `
        <div class="card">
            <h2>⚠️ 警告和错误</h2>
            ${result.warnings.map(w => `<div class="warning">⚠ ${w}</div>`).join('')}
            ${result.errors.map(e => `<div class="error">✗ ${e}</div>`).join('')}
        </div>
        ` : ''}
        
        <div class="footer">
            <p>由 HarmonyOS Lifecycle Analyzer 生成</p>
            <p>分析时间: ${result.project.analyzedAt}</p>
        </div>
    </div>
</body>
</html>`;
    }

    /**
     * 生成 Markdown 格式报告
     */
    private generateMarkdown(result: AnalysisResult, options: ReportOptions): string {
        const title = options.title || 'HarmonyOS 生命周期分析报告';
        const lines: string[] = [];
        
        lines.push(`# ${title}`);
        lines.push('');
        lines.push(`> 分析时间: ${result.project.analyzedAt}`);
        lines.push('');
        
        // 项目信息
        lines.push('## 📁 项目信息');
        lines.push('');
        lines.push(`- **路径**: \`${result.project.path}\``);
        lines.push(`- **名称**: ${result.project.name}`);
        lines.push('');
        
        // 统计摘要
        lines.push('## 📊 统计摘要');
        lines.push('');
        lines.push('| 指标 | 数量 |');
        lines.push('|------|------|');
        lines.push(`| 文件 | ${result.summary.totalFiles} |`);
        lines.push(`| 类 | ${result.summary.totalClasses} |`);
        lines.push(`| Ability | ${result.summary.abilityCount} |`);
        lines.push(`| Component | ${result.summary.componentCount} |`);
        lines.push(`| 生命周期方法 | ${result.summary.lifecycleMethodCount} |`);
        lines.push(`| UI 回调 | ${result.summary.uiCallbackCount} |`);
        lines.push(`| 导航关系 | ${result.summary.navigationCount} |`);
        lines.push('');
        
        // Ability 列表
        lines.push('## 🎯 Ability 列表');
        lines.push('');
        lines.push('| 名称 | 类名 | 入口 | 生命周期方法 |');
        lines.push('|------|------|:----:|--------------|');
        for (const a of result.abilities) {
            const entry = a.isEntry ? '✅' : '';
            lines.push(`| ${a.name} | ${a.className} | ${entry} | ${a.lifecycleMethods.join(', ')} |`);
        }
        lines.push('');
        
        // Component 列表
        lines.push('## 🧩 Component 列表');
        lines.push('');
        lines.push('| 名称 | 类名 | 生命周期方法 | UI 回调数 |');
        lines.push('|------|------|--------------|-----------|');
        for (const c of result.components) {
            lines.push(`| ${c.name} | ${c.className} | ${c.lifecycleMethods.join(', ')} | ${c.uiCallbacks.length} |`);
        }
        lines.push('');
        
        // UI 回调统计
        if (Object.keys(result.uiCallbacksByType).length > 0) {
            lines.push('## 👆 UI 回调分布');
            lines.push('');
            lines.push('| 类型 | 数量 |');
            lines.push('|------|------|');
            for (const [type, count] of Object.entries(result.uiCallbacksByType)) {
                lines.push(`| ${type} | ${count} |`);
            }
            lines.push('');
        }
        
        // 导航关系
        if (result.navigations.length > 0) {
            lines.push('## 🔗 导航关系');
            lines.push('');
            lines.push('| 来源 | 目标 | 类型 |');
            lines.push('|------|------|------|');
            for (const n of result.navigations) {
                lines.push(`| ${n.source} | ${n.target} | ${n.type} |`);
            }
            lines.push('');
        }
        
        // DummyMain 信息
        if (result.dummyMain) {
            lines.push('## 🔧 DummyMain 信息');
            lines.push('');
            lines.push(`- **方法签名**: \`${result.dummyMain.methodSignature}\``);
            lines.push(`- **基本块数**: ${result.dummyMain.blockCount}`);
            lines.push(`- **语句数**: ${result.dummyMain.stmtCount}`);
            lines.push(`- **生命周期调用**: ${result.dummyMain.lifecycleCallCount}`);
            lines.push(`- **UI 回调调用**: ${result.dummyMain.uiCallbackCount}`);
            lines.push('');
        }
        
        // 耗时统计
        lines.push('## ⏱️ 耗时统计');
        lines.push('');
        lines.push('| 阶段 | 耗时 |');
        lines.push('|------|------|');
        lines.push(`| Scene 构建 | ${result.duration.sceneBuilding}ms |`);
        lines.push(`| Ability 收集 | ${result.duration.abilityCollection}ms |`);
        lines.push(`| Component 收集 | ${result.duration.componentCollection}ms |`);
        lines.push(`| UI 回调提取 | ${result.duration.uiCallbackExtraction}ms |`);
        lines.push(`| 导航分析 | ${result.duration.navigationAnalysis}ms |`);
        lines.push(`| DummyMain 生成 | ${result.duration.dummyMainGeneration}ms |`);
        lines.push(`| **总耗时** | **${result.duration.total}ms** |`);
        lines.push('');
        
        // 警告和错误
        if (result.warnings.length > 0) {
            lines.push('## ⚠️ 警告');
            lines.push('');
            for (const w of result.warnings) {
                lines.push(`- ${w}`);
            }
            lines.push('');
        }
        
        if (result.errors.length > 0) {
            lines.push('## ❌ 错误');
            lines.push('');
            for (const e of result.errors) {
                lines.push(`- ${e}`);
            }
            lines.push('');
        }
        
        lines.push('---');
        lines.push('');
        lines.push('*由 HarmonyOS Lifecycle Analyzer 生成*');
        
        return lines.join('\n');
    }
}
