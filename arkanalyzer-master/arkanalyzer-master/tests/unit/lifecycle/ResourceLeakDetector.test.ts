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
 * @file ResourceLeakDetector.test.ts
 * @description 资源泄漏检测器集成测试
 */

import { describe, expect, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

import { ResourceLeakDetector } from '../../../src/TEST_lifecycle/taint/ResourceLeakDetector';
import { SourceSinkManager } from '../../../src/TEST_lifecycle/taint/SourceSinkManager';

// ============================================================================
// 测试配置
// ============================================================================

const SDK_DIR = path.join(__dirname, '../../resources/Sdk');
const sdk: Sdk = {
    name: '',
    path: SDK_DIR,
    moduleName: ''
};

/**
 * 构建 Scene 的辅助函数
 */
function buildScene(projectPath: string): Scene {
    const fullPath = path.join(__dirname, '../../resources/lifecycle', projectPath);
    let config: SceneConfig = new SceneConfig();
    config.buildConfig(fullPath, fullPath, [sdk]);
    config.buildFromProjectDir(fullPath);
    let scene = new Scene();
    scene.buildSceneFromProjectDir(config);
    scene.inferTypes();
    return scene;
}

// ============================================================================
// ResourceLeakDetector 测试
// ============================================================================

describe('ResourceLeakDetector', () => {
    let scene: Scene;
    
    beforeAll(() => {
        scene = buildScene('simple');
    });
    
    describe('基本功能', () => {
        it('应该能够创建检测器实例', () => {
            const detector = new ResourceLeakDetector(scene);
            
            expect(detector).not.toBeNull();
            expect(detector.getSourceSinkManager()).not.toBeNull();
        });
        
        it('应该能够执行检测', () => {
            const detector = new ResourceLeakDetector(scene);
            
            const leaks = detector.detect();
            
            expect(Array.isArray(leaks)).toBe(true);
            expect(detector.getAnalyzedMethodCount()).toBeGreaterThan(0);
            
            console.log(`[Test] 分析了 ${detector.getAnalyzedMethodCount()} 个方法`);
            console.log(`[Test] 发现 ${detector.getSourceCount()} 个 Source`);
            console.log(`[Test] 发现 ${detector.getSinkCount()} 个 Sink`);
            console.log(`[Test] 检测到 ${leaks.length} 个泄漏`);
        });
        
        it('应该使用默认的 SourceSinkManager', () => {
            const detector = new ResourceLeakDetector(scene);
            const ssm = detector.getSourceSinkManager();
            
            // 默认应该加载 HarmonyOS 规则
            expect(ssm.getSourceCount()).toBeGreaterThan(0);
            expect(ssm.getSinkCount()).toBeGreaterThan(0);
        });
        
        it('应该能够使用自定义 SourceSinkManager', () => {
            const customSSM = new SourceSinkManager();
            customSSM.clearRules();
            
            const detector = new ResourceLeakDetector(scene, {
                sourceSinkManager: customSSM,
            });
            
            expect(detector.getSourceSinkManager().getSourceCount()).toBe(0);
        });
    });
    
    describe('SourceSinkManager 规则', () => {
        it('SourceSinkManager 应该包含 HarmonyOS 资源规则', () => {
            const detector = new ResourceLeakDetector(scene);
            const ssm = detector.getSourceSinkManager();
            
            // 验证一些关键的 Source
            expect(ssm.isSource({ className: 'media', methodName: 'createAVPlayer' })).not.toBeNull();
            expect(ssm.isSource({ className: 'fs', methodName: 'open' })).not.toBeNull();
            expect(ssm.isSource({ className: 'http', methodName: 'createHttp' })).not.toBeNull();
            
            // 验证一些关键的 Sink
            expect(ssm.isSink({ className: 'AVPlayer', methodName: 'release' })).not.toBeNull();
            expect(ssm.isSink({ className: 'fs', methodName: 'close' })).not.toBeNull();
            expect(ssm.isSink({ className: 'HttpRequest', methodName: 'destroy' })).not.toBeNull();
        });
    });
    
    describe('泄漏报告格式', () => {
        it('泄漏报告应该包含必要的信息', () => {
            const detector = new ResourceLeakDetector(scene);
            const leaks = detector.detect();
            
            // 即使 simple 项目没有资源泄漏，我们验证返回的是数组
            expect(Array.isArray(leaks)).toBe(true);
            
            // 如果有泄漏，验证格式
            if (leaks.length > 0) {
                const leak = leaks[0];
                expect(leak).toHaveProperty('resourceType');
                expect(leak).toHaveProperty('sourceMethod');
                expect(leak).toHaveProperty('className');
                expect(leak).toHaveProperty('methodName');
                expect(leak).toHaveProperty('filePath');
                expect(leak).toHaveProperty('lineNumber');
                expect(leak).toHaveProperty('expectedSink');
                expect(leak).toHaveProperty('variableName');
                expect(leak).toHaveProperty('severity');
                expect(leak).toHaveProperty('description');
            }
        });
    });
});

// ============================================================================
// LifecycleAnalyzer 集成测试
// ============================================================================

describe('LifecycleAnalyzer 资源泄漏检测集成', () => {
    it('LifecycleAnalyzer 应该包含资源泄漏检测功能', async () => {
        // 动态导入以避免循环依赖问题
        const { LifecycleAnalyzer } = await import('../../../src/TEST_lifecycle/cli/LifecycleAnalyzer');
        
        const analyzer = new LifecycleAnalyzer({
            sdkPath: SDK_DIR,
            detectResourceLeaks: true,
            verbose: false,
        });
        
        const projectPath = path.join(__dirname, '../../resources/lifecycle/simple');
        const result = await analyzer.analyze(projectPath);
        
        // 验证结果包含资源泄漏信息
        expect(result.summary).toHaveProperty('resourceLeakCount');
        expect(result.duration).toHaveProperty('resourceLeakDetection');
        
        console.log(`[Test] 资源泄漏检测耗时: ${result.duration.resourceLeakDetection}ms`);
        console.log(`[Test] 发现资源泄漏: ${result.summary.resourceLeakCount}`);
        
        if (result.resourceLeaks) {
            console.log(`[Test] 分析方法数: ${result.resourceLeaks.summary.analyzedMethods}`);
            console.log(`[Test] Source 数: ${result.resourceLeaks.summary.sourceCount}`);
            console.log(`[Test] Sink 数: ${result.resourceLeaks.summary.sinkCount}`);
        }
    });
    
    it('应该能够禁用资源泄漏检测', async () => {
        const { LifecycleAnalyzer } = await import('../../../src/TEST_lifecycle/cli/LifecycleAnalyzer');
        
        const analyzer = new LifecycleAnalyzer({
            sdkPath: SDK_DIR,
            detectResourceLeaks: false,
        });
        
        const projectPath = path.join(__dirname, '../../resources/lifecycle/simple');
        const result = await analyzer.analyze(projectPath);
        
        // 禁用后不应该有资源泄漏结果
        expect(result.resourceLeaks).toBeUndefined();
        expect(result.summary.resourceLeakCount).toBe(0);
    });
});

// ============================================================================
// 模拟资源泄漏场景测试
// ============================================================================

describe('资源泄漏检测逻辑验证', () => {
    it('SourceSinkManager 应该能正确配对 Source 和 Sink', () => {
        const ssm = new SourceSinkManager();
        
        // AVPlayer
        const avPlayerSource = ssm.isSource({ className: 'media', methodName: 'createAVPlayer' });
        expect(avPlayerSource).not.toBeNull();
        
        const avPlayerSink = ssm.getPairedSink(avPlayerSource!);
        expect(avPlayerSink).not.toBeNull();
        expect(avPlayerSink?.id).toBe('AVPlayer.release');
        
        // File
        const fileSource = ssm.isSource({ className: 'fs', methodName: 'open' });
        expect(fileSource).not.toBeNull();
        
        const fileSink = ssm.getPairedSink(fileSource!);
        expect(fileSink).not.toBeNull();
        expect(fileSink?.id).toBe('fs.close');
        
        // HttpRequest
        const httpSource = ssm.isSource({ className: 'http', methodName: 'createHttp' });
        expect(httpSource).not.toBeNull();
        
        const httpSink = ssm.getPairedSink(httpSource!);
        expect(httpSink).not.toBeNull();
        expect(httpSink?.id).toBe('HttpRequest.destroy');
    });
    
    it('Sink 应该正确标记需要污染的参数或 this', () => {
        const ssm = new SourceSinkManager();
        
        // AVPlayer.release 需要污染的 this
        const avPlayerSink = ssm.isSink({ className: 'AVPlayer', methodName: 'release' });
        expect(avPlayerSink?.requireTaintedThis).toBe(true);
        
        // fs.close 需要污染的第一个参数
        const fileSink = ssm.isSink({ className: 'fs', methodName: 'close' });
        expect(fileSink?.requiredTaintedParamIndices).toContain(0);
    });
});
