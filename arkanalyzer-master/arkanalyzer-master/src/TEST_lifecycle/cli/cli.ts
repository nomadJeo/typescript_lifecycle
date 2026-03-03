#!/usr/bin/env node
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
 * @file cli/cli.ts
 * @description 命令行入口 - HarmonyOS 生命周期分析工具
 * 
 * 使用方式:
 *   npx ts-node src/TEST_lifecycle/cli/cli.ts analyze <project-path> [options]
 * 
 * 或编译后:
 *   node lib/TEST_lifecycle/cli/cli.js analyze <project-path> [options]
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { LifecycleAnalyzer, AnalysisOptions } from './LifecycleAnalyzer';
import { ReportGenerator, ReportFormat } from './ReportGenerator';

// ============================================================================
// 版本信息
// ============================================================================

const VERSION = '1.0.0';
const NAME = 'harmony-lifecycle-analyzer';

// ============================================================================
// CLI 实现
// ============================================================================

/**
 * 创建 CLI 程序
 */
function createProgram(): Command {
    const program = new Command();
    
    program
        .name(NAME)
        .version(VERSION)
        .description('HarmonyOS 生命周期分析工具 - 分析 Ability、Component 和 UI 回调');
    
    // analyze 命令
    program
        .command('analyze <project-path>')
        .description('分析 HarmonyOS 项目的生命周期')
        .option('-o, --output <path>', '输出文件路径')
        .option('-f, --format <format>', '输出格式 (json|text|html|markdown)', 'text')
        .option('--sdk <path>', 'HarmonyOS SDK 路径')
        .option('--no-infer-types', '禁用类型推断')
        .option('--no-dummy-main', '不生成 DummyMain')
        .option('--no-navigation', '不分析导航关系')
        .option('--no-ui-callbacks', '不提取 UI 回调')
        .option('-v, --verbose', '输出详细日志')
        .option('-d, --detailed', '在报告中包含详细信息')
        .option('--title <title>', '报告标题')
        .action(async (projectPath: string, options) => {
            await runAnalyze(projectPath, options);
        });
    
    // quick 命令 - 快速查看摘要
    program
        .command('quick <project-path>')
        .description('快速查看项目摘要（仅统计，不生成报告）')
        .option('--sdk <path>', 'HarmonyOS SDK 路径')
        .action(async (projectPath: string, options) => {
            await runQuick(projectPath, options);
        });
    
    // version 命令
    program
        .command('version')
        .description('显示版本信息')
        .action(() => {
            console.log(`${NAME} v${VERSION}`);
        });
    
    return program;
}

/**
 * 执行分析命令
 */
async function runAnalyze(projectPath: string, options: any): Promise<void> {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║       HarmonyOS 生命周期分析工具 v' + VERSION + '                   ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    
    // 验证项目路径
    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ 错误: 项目路径不存在: ${resolvedPath}`);
        process.exit(1);
    }
    
    console.log(`📁 项目路径: ${resolvedPath}`);
    console.log(`📄 输出格式: ${options.format}`);
    if (options.output) {
        console.log(`📤 输出文件: ${options.output}`);
    }
    console.log('');
    console.log('正在分析...');
    console.log('');
    
    try {
        // 配置分析选项
        const analysisOptions: AnalysisOptions = {
            sdkPath: options.sdk,
            inferTypes: options.inferTypes !== false,
            generateDummyMain: options.dummyMain !== false,
            analyzeNavigation: options.navigation !== false,
            extractUICallbacks: options.uiCallbacks !== false,
            verbose: options.verbose || false,
        };
        
        // 执行分析
        const analyzer = new LifecycleAnalyzer(analysisOptions);
        const result = await analyzer.analyze(resolvedPath);
        
        // 生成报告
        const reportGenerator = new ReportGenerator();
        const format = options.format as ReportFormat;
        
        const reportContent = reportGenerator.generate(result, {
            format,
            outputPath: options.output,
            detailed: options.detailed || false,
            title: options.title,
        });
        
        // 如果没有指定输出文件，打印到控制台
        if (!options.output) {
            console.log(reportContent);
        } else {
            console.log(`✅ 报告已保存至: ${options.output}`);
        }
        
        // 输出摘要
        console.log('');
        console.log('════════════════════════════════════════════════════════════');
        console.log('                        分析完成                              ');
        console.log('════════════════════════════════════════════════════════════');
        console.log(`  📦 Ability: ${result.summary.abilityCount}`);
        console.log(`  🧩 Component: ${result.summary.componentCount}`);
        console.log(`  🔄 生命周期方法: ${result.summary.lifecycleMethodCount}`);
        console.log(`  👆 UI 回调: ${result.summary.uiCallbackCount}`);
        console.log(`  🔗 导航关系: ${result.summary.navigationCount}`);
        console.log(`  ⏱️  总耗时: ${result.duration.total}ms`);
        console.log('════════════════════════════════════════════════════════════');
        
    } catch (error) {
        console.error('');
        console.error(`❌ 分析失败: ${error}`);
        if (options.verbose && error instanceof Error) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

/**
 * 执行快速查看命令
 */
async function runQuick(projectPath: string, options: any): Promise<void> {
    console.log('');
    console.log('🔍 快速分析中...');
    console.log('');
    
    // 验证项目路径
    const resolvedPath = path.resolve(projectPath);
    if (!fs.existsSync(resolvedPath)) {
        console.error(`❌ 错误: 项目路径不存在: ${resolvedPath}`);
        process.exit(1);
    }
    
    try {
        const analysisOptions: AnalysisOptions = {
            sdkPath: options.sdk,
            inferTypes: false,
            generateDummyMain: false,
            analyzeNavigation: false,
            extractUICallbacks: true,
            verbose: false,
        };
        
        const analyzer = new LifecycleAnalyzer(analysisOptions);
        const result = await analyzer.analyze(resolvedPath);
        
        console.log('┌─────────────────────────────────────┐');
        console.log('│          项目摘要                    │');
        console.log('├─────────────────────────────────────┤');
        console.log(`│  项目名称: ${result.project.name.padEnd(22)} │`);
        console.log(`│  文件数量: ${String(result.summary.totalFiles).padEnd(22)} │`);
        console.log(`│  类数量:   ${String(result.summary.totalClasses).padEnd(22)} │`);
        console.log(`│  Ability:  ${String(result.summary.abilityCount).padEnd(22)} │`);
        console.log(`│  Component:${String(result.summary.componentCount).padEnd(22)} │`);
        console.log(`│  UI 回调:  ${String(result.summary.uiCallbackCount).padEnd(22)} │`);
        console.log(`│  耗时:     ${(result.duration.total + 'ms').padEnd(22)} │`);
        console.log('└─────────────────────────────────────┘');
        
    } catch (error) {
        console.error(`❌ 分析失败: ${error}`);
        process.exit(1);
    }
}

/**
 * 运行 CLI
 */
export function runCLI(): void {
    const program = createProgram();
    program.parse(process.argv);
}

// 如果直接运行此文件
if (require.main === module) {
    runCLI();
}
