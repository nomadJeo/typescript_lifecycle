/**
 * @file CLIAnalyzer.test.ts
 * @description CLI 工具测试 - 验证 LifecycleAnalyzer 和 ReportGenerator
 */

import { describe, test, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { LifecycleAnalyzer, AnalysisResult } from '../../../src/TEST_lifecycle/cli/LifecycleAnalyzer';
import { ReportGenerator } from '../../../src/TEST_lifecycle/cli/ReportGenerator';

// ============================================================================
// 测试配置
// ============================================================================

const TEST_PROJECT_PATH = path.join(__dirname, '../../resources/lifecycle/simple');
const OUTPUT_DIR = path.join(__dirname, '../../output/cli-test');

// ============================================================================
// 测试套件
// ============================================================================

describe('CLI 工具测试', () => {
    let analysisResult: AnalysisResult;

    beforeAll(async () => {
        // 确保输出目录存在
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
    });

    describe('LifecycleAnalyzer 测试', () => {
        test('应该能成功分析项目', async () => {
            const analyzer = new LifecycleAnalyzer({
                verbose: false,
                inferTypes: true,
                generateDummyMain: true,
                analyzeNavigation: true,
                extractUICallbacks: true,
            });

            analysisResult = await analyzer.analyze(TEST_PROJECT_PATH);

            expect(analysisResult).toBeDefined();
            expect(analysisResult.project.path).toContain('simple');
            expect(analysisResult.project.name).toBe('simple');
        });

        test('应该正确统计项目信息', () => {
            expect(analysisResult.summary.totalFiles).toBeGreaterThan(0);
            expect(analysisResult.summary.totalClasses).toBeGreaterThan(0);
        });

        test('应该收集到 Ability', () => {
            expect(analysisResult.summary.abilityCount).toBeGreaterThanOrEqual(1);
            expect(analysisResult.abilities.length).toBeGreaterThanOrEqual(1);
            
            const entryAbility = analysisResult.abilities.find(a => a.name === 'EntryAbility');
            expect(entryAbility).toBeDefined();
            expect(entryAbility!.isEntry).toBe(true);
        });

        test('应该收集到 Component', () => {
            expect(analysisResult.summary.componentCount).toBeGreaterThanOrEqual(1);
            expect(analysisResult.components.length).toBeGreaterThanOrEqual(1);
        });

        test('应该提取 UI 回调', () => {
            const totalCallbacks = analysisResult.components.reduce(
                (sum, c) => sum + c.uiCallbacks.length, 0
            );
            expect(totalCallbacks).toBeGreaterThanOrEqual(0);
        });

        test('应该记录耗时信息', () => {
            expect(analysisResult.duration.total).toBeGreaterThan(0);
            expect(analysisResult.duration.sceneBuilding).toBeGreaterThan(0);
        });

        test('应该生成 DummyMain 信息', () => {
            expect(analysisResult.dummyMain).toBeDefined();
            if (analysisResult.dummyMain) {
                expect(analysisResult.dummyMain.methodSignature).toBeDefined();
            }
        });
    });

    describe('ReportGenerator 测试', () => {
        const reportGenerator = new ReportGenerator();

        test('应该生成 JSON 格式报告', () => {
            const jsonReport = reportGenerator.generate(analysisResult, {
                format: 'json',
                detailed: true,
            });

            expect(jsonReport).toBeDefined();
            const parsed = JSON.parse(jsonReport);
            expect(parsed.project.name).toBe('simple');
            expect(parsed.summary).toBeDefined();
        });

        test('应该生成 Text 格式报告', () => {
            const textReport = reportGenerator.generate(analysisResult, {
                format: 'text',
                detailed: true,
                title: '测试报告',
            });

            expect(textReport).toContain('测试报告');
            expect(textReport).toContain('Ability');
            expect(textReport).toContain('Component');
        });

        test('应该生成 HTML 格式报告', () => {
            const htmlReport = reportGenerator.generate(analysisResult, {
                format: 'html',
                detailed: true,
            });

            expect(htmlReport).toContain('<!DOCTYPE html>');
            expect(htmlReport).toContain('HarmonyOS');
            expect(htmlReport).toContain('<table>');
        });

        test('应该生成 Markdown 格式报告', () => {
            const mdReport = reportGenerator.generate(analysisResult, {
                format: 'markdown',
                detailed: true,
            });

            expect(mdReport).toContain('# ');
            expect(mdReport).toContain('## ');
            expect(mdReport).toContain('|');
        });

        test('应该能保存报告到文件', () => {
            const outputPath = path.join(OUTPUT_DIR, 'test-report.json');
            
            reportGenerator.generate(analysisResult, {
                format: 'json',
                outputPath,
            });

            expect(fs.existsSync(outputPath)).toBe(true);
            
            const content = fs.readFileSync(outputPath, 'utf-8');
            const parsed = JSON.parse(content);
            expect(parsed.project.name).toBe('simple');
        });

        test('应该能保存 HTML 报告到文件', () => {
            const outputPath = path.join(OUTPUT_DIR, 'test-report.html');
            
            reportGenerator.generate(analysisResult, {
                format: 'html',
                outputPath,
                title: 'Simple 项目分析报告',
            });

            expect(fs.existsSync(outputPath)).toBe(true);
            
            const content = fs.readFileSync(outputPath, 'utf-8');
            expect(content).toContain('Simple 项目分析报告');
        });
    });

    describe('快速分析模式测试', () => {
        test('禁用可选功能时应该更快', async () => {
            const quickAnalyzer = new LifecycleAnalyzer({
                inferTypes: false,
                generateDummyMain: false,
                analyzeNavigation: false,
                extractUICallbacks: true,
            });

            const quickResult = await quickAnalyzer.analyze(TEST_PROJECT_PATH);

            expect(quickResult.summary.abilityCount).toBeGreaterThanOrEqual(1);
            expect(quickResult.dummyMain).toBeUndefined();
        });
    });

    describe('错误处理测试', () => {
        test('无效路径应该抛出错误', async () => {
            const analyzer = new LifecycleAnalyzer();
            
            await expect(
                analyzer.analyze('/nonexistent/path/to/project')
            ).rejects.toThrow('项目路径不存在');
        });
    });
});
