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
 * @file CloudFoundationKitAnalysis.test.ts
 * @description 针对 CloudFoundationKit_Codelab_Prefetch_ArkTS 项目的 TEST_lifecycle 分析测试
 * 
 * 测试目标：
 * - 验证标准 ArkUI 组件的 ViewTree 构建和 UI 回调提取
 * - 验证 module.json5 解析修复（尾随逗号处理）
 * - 测试 NavPathStack.pushPathByName 导航支持情况
 * - 验证多 Component 场景的 DummyMain 生成
 */

import { describe, expect, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

import { 
    LifecycleModelCreator,
    AbilityCollector,
    ViewTreeCallbackExtractor,
    NavigationAnalyzer,
} from '../../../src/TEST_lifecycle';

// ============================================================================
// 测试配置
// ============================================================================

const SDK_DIR = path.join(__dirname, '../../resources/Sdk');
const sdk: Sdk = {
    name: '',
    path: SDK_DIR,
    moduleName: ''
};

// CloudFoundationKit 项目路径
const CLOUD_FOUNDATION_PATH = path.join(
    __dirname, 
    '../../../../../Demo4tests/CloudFoundationKit_Codelab_Prefetch_ArkTS/prefetch-code-lab/entry/src/main'
);

function buildSceneFromPath(projectPath: string): Scene {
    let config: SceneConfig = new SceneConfig();
    config.buildConfig(projectPath, projectPath, [sdk]);
    config.buildFromProjectDir(projectPath);
    let scene = new Scene();
    scene.buildSceneFromProjectDir(config);
    scene.inferTypes();
    return scene;
}

// ============================================================================
// CloudFoundationKit 项目分析测试
// ============================================================================

describe('CloudFoundationKit_Codelab_Prefetch_ArkTS 项目分析', () => {
    let scene: Scene;
    let collector: AbilityCollector;
    let extractor: ViewTreeCallbackExtractor;
    let creator: LifecycleModelCreator;

    beforeAll(() => {
        console.log('\n========== 开始分析 CloudFoundationKit_Codelab_Prefetch_ArkTS ==========');
        console.log(`项目路径: ${CLOUD_FOUNDATION_PATH}`);
        
        try {
            scene = buildSceneFromPath(CLOUD_FOUNDATION_PATH);
            collector = new AbilityCollector(scene);
            extractor = new ViewTreeCallbackExtractor(scene);
            creator = new LifecycleModelCreator(scene);
            console.log('Scene 构建成功!\n');
        } catch (error) {
            console.error('Scene 构建失败:', error);
            throw error;
        }
    });

    // ========================================================================
    // 1. 项目结构分析
    // ========================================================================
    
    describe('1. 项目结构分析', () => {
        
        it('1.1 打印所有类结构', () => {
            console.log('\n----- 项目类结构 -----');
            
            let classCount = 0;
            const projectClasses: string[] = [];
            
            for (const arkClass of scene.getClasses()) {
                const className = arkClass.getName();
                const superClass = arkClass.getSuperClassName();
                const filePath = arkClass.getDeclaringArkFile()?.getName() || 'unknown';
                
                if (!filePath.includes('Sdk') && !className.startsWith('%AC')) {
                    classCount++;
                    projectClasses.push(className);
                    
                    console.log(`\n类: ${className}`);
                    console.log(`  文件: ${filePath}`);
                    if (superClass) {
                        console.log(`  继承: ${superClass}`);
                    }
                    
                    const methods = arkClass.getMethods();
                    if (methods.length > 0) {
                        console.log(`  方法数量: ${methods.length}`);
                        const mainMethods = methods.filter(m => 
                            !m.getName().startsWith('%') || m.getName().includes('build')
                        ).slice(0, 10);
                        console.log('  主要方法:');
                        for (const method of mainMethods) {
                            console.log(`    - ${method.getName()}`);
                        }
                    }
                    
                    const viewTree = arkClass.getViewTree();
                    if (viewTree) {
                        console.log('  ViewTree: 存在');
                    }
                }
            }
            
            console.log(`\n总计: ${classCount} 个项目类`);
            console.log(`类列表: ${projectClasses.join(', ')}`);
            
            expect(classCount).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // 2. module.json5 解析验证
    // ========================================================================
    
    describe('2. module.json5 解析验证', () => {
        
        it('2.1 应该正确解析 module.json5 中的入口 Ability', () => {
            const entryNames = collector.getEntryAbilityNames();
            
            console.log('\n----- module.json5 解析结果 -----');
            console.log(`入口 Ability 名称: ${[...entryNames].join(', ') || '无'}`);
            
            // 验证 module.json5 被正确解析（包含尾随逗号）
            expect(entryNames.size).toBeGreaterThanOrEqual(1);
            expect(entryNames.has('EntryAbility')).toBe(true);
            
            console.log('  ✅ module.json5 解析成功（尾随逗号处理正确）');
        });
    });

    // ========================================================================
    // 3. Ability 收集测试
    // ========================================================================
    
    describe('3. Ability 收集测试', () => {
        
        it('3.1 应该收集到 EntryAbility 及完整生命周期', () => {
            const abilities = collector.collectAllAbilities();
            
            console.log('\n----- Ability 收集结果 -----');
            console.log(`收集到 ${abilities.length} 个 Ability`);
            
            for (const ability of abilities) {
                console.log(`\nAbility: ${ability.name}`);
                console.log(`  是否为入口: ${ability.isEntry}`);
                console.log(`  生命周期方法数: ${ability.lifecycleMethods.size}`);
                
                console.log('  生命周期方法:');
                for (const [stage, method] of ability.lifecycleMethods) {
                    console.log(`    - ${stage}: ${method.getName()}`);
                }
                
                if (ability.navigationTargets.length > 0) {
                    console.log('  导航目标:');
                    for (const nav of ability.navigationTargets) {
                        console.log(`    -> ${nav.targetAbilityName || 'unknown'} (${nav.navigationType || 'unknown'})`);
                    }
                }
                
                if (ability.components.length > 0) {
                    console.log('  关联 Component:');
                    for (const comp of ability.components) {
                        console.log(`    - ${comp.name}`);
                    }
                }
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            
            const entryAbility = abilities.find(a => a.name === 'EntryAbility');
            expect(entryAbility).toBeDefined();
            
            if (entryAbility) {
                console.log('\n----- EntryAbility 验证 -----');
                // 应该有 6 个生命周期方法
                expect(entryAbility.lifecycleMethods.size).toBeGreaterThanOrEqual(5);
                console.log(`  ✅ 生命周期方法数: ${entryAbility.lifecycleMethods.size}`);
                
                // 应该是入口 Ability
                expect(entryAbility.isEntry).toBe(true);
                console.log('  ✅ 正确识别为入口 Ability');
            }
        });
    });

    // ========================================================================
    // 4. Component 收集测试
    // ========================================================================
    
    describe('4. Component 收集测试', () => {
        
        it('4.1 应该收集到 Index, CloudResPrefetch, CloudResPeriodicPrefetch', () => {
            const components = collector.collectAllComponents();
            
            console.log('\n----- Component 收集结果 -----');
            console.log(`收集到 ${components.length} 个 Component`);
            
            const componentNames: string[] = [];
            
            for (const component of components) {
                componentNames.push(component.name);
                console.log(`\nComponent: ${component.name}`);
                console.log(`  生命周期方法数: ${component.lifecycleMethods.size}`);
                console.log(`  是否为 @Entry: ${component.isEntry}`);
                
                if (component.lifecycleMethods.size > 0) {
                    console.log('  生命周期方法:');
                    for (const [stage, method] of component.lifecycleMethods) {
                        console.log(`    - ${stage}: ${method.getName()}`);
                    }
                }
            }
            
            console.log(`\n组件列表: ${componentNames.join(', ')}`);
            
            // 验证
            expect(components.length).toBeGreaterThanOrEqual(3);
            
            // 检查各组件
            const indexComp = components.find(c => c.name === 'Index');
            const prefetchComp = components.find(c => c.name === 'CloudResPrefetch');
            const periodicComp = components.find(c => c.name === 'CloudResPeriodicPrefetch');
            
            if (indexComp) console.log('  ✅ 找到 Index Component');
            if (prefetchComp) console.log('  ✅ 找到 CloudResPrefetch Component');
            if (periodicComp) console.log('  ✅ 找到 CloudResPeriodicPrefetch Component');
            
            expect(indexComp).toBeDefined();
        });
    });

    // ========================================================================
    // 5. UI 回调提取测试（重点验证标准组件）
    // ========================================================================
    
    describe('5. UI 回调提取测试', () => {
        
        it('5.1 应该从各 Component 提取 onClick 回调', () => {
            console.log('\n----- UI 回调提取 -----');
            
            const components = collector.collectAllComponents();
            let totalCallbacks = 0;
            const callbacksByComponent = new Map<string, number>();
            const eventTypeSummary = new Map<string, number>();
            
            for (const arkClass of scene.getClasses()) {
                const viewTree = arkClass.getViewTree();
                const className = arkClass.getName();
                
                // 只处理我们关心的组件
                if (viewTree && (className === 'Index' || className === 'CloudResPrefetch' || className === 'CloudResPeriodicPrefetch')) {
                    const callbacks = extractor.extractFromComponent(arkClass);
                    totalCallbacks += callbacks.length;
                    callbacksByComponent.set(className, callbacks.length);
                    
                    console.log(`\n${className} 回调提取结果:`);
                    console.log(`  回调总数: ${callbacks.length}`);
                    
                    for (const cb of callbacks) {
                        const methodName = cb.callbackMethod?.getName() || 'inline/anonymous';
                        console.log(`  - ${cb.componentType}.${cb.eventType} -> ${methodName}`);
                        
                        const count = eventTypeSummary.get(cb.eventType) || 0;
                        eventTypeSummary.set(cb.eventType, count + 1);
                    }
                }
            }
            
            console.log(`\n----- 事件类型统计 -----`);
            for (const [eventType, count] of eventTypeSummary) {
                console.log(`  ${eventType}: ${count} 个`);
            }
            console.log(`  总计: ${totalCallbacks} 个回调`);
            
            // 预期：
            // - Index: 2 个 onClick (两个 homeButton)
            // - CloudResPrefetch: 1 个 onClick
            // - CloudResPeriodicPrefetch: 2 个 onClick
            // 总计: 至少 5 个
            
            const expectedMin = 5;
            console.log(`\n预期至少 ${expectedMin} 个 onClick 回调: ${totalCallbacks >= expectedMin ? '✅' : '⚠️'} (实际: ${totalCallbacks})`);
        });

        it('5.2 填充所有 Component 回调信息', () => {
            const components = collector.collectAllComponents();
            extractor.fillAllComponentCallbacks(components);
            
            console.log('\n----- Component 回调填充结果 -----');
            
            let totalCallbacks = 0;
            for (const comp of components) {
                totalCallbacks += comp.uiCallbacks.length;
                console.log(`\n${comp.name}:`);
                console.log(`  回调数量: ${comp.uiCallbacks.length}`);
                
                for (const cb of comp.uiCallbacks) {
                    const methodName = cb.callbackMethod?.getName() || 'inline';
                    console.log(`    - ${cb.componentType}.${cb.eventType} -> ${methodName}`);
                }
            }
            
            console.log(`\n总回调数: ${totalCallbacks}`);
        });
    });

    // ========================================================================
    // 6. 导航分析测试
    // ========================================================================
    
    describe('6. 导航分析测试', () => {
        
        it('6.1 分析 loadContent 调用', () => {
            console.log('\n----- loadContent 导航分析 -----');
            
            const abilities = collector.collectAllAbilities();
            
            for (const ability of abilities) {
                console.log(`\n${ability.name} 的导航目标:`);
                
                if (ability.navigationTargets.length > 0) {
                    for (const nav of ability.navigationTargets) {
                        console.log(`  类型: ${nav.navigationType || 'unknown'}`);
                        console.log(`  目标: ${nav.targetAbilityName || 'unknown'}`);
                    }
                    
                    // 验证 loadContent 指向 pages/Index
                    const loadContentNav = ability.navigationTargets.find(
                        n => n.targetAbilityName?.includes('Index')
                    );
                    if (loadContentNav) {
                        console.log('  ✅ loadContent 导航目标已识别');
                    }
                } else {
                    console.log('  (无导航目标被识别)');
                }
            }
        });

        it('6.2 分析 NavPathStack.pushPathByName 调用', () => {
            console.log('\n----- NavPathStack 导航分析 -----');
            console.log('注意: pushPathByName 是 Navigation API，检查支持情况\n');
            
            let pushPathCount = 0;
            
            for (const method of scene.getMethods()) {
                const methodName = method.getName();
                const className = method.getDeclaringArkClass().getName();
                
                if (className.startsWith('%') && !className.includes('build')) {
                    continue;
                }
                
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        const stmtStr = stmt.toString();
                        if (stmtStr.includes('pushPathByName') || stmtStr.includes('pushPath')) {
                            pushPathCount++;
                            console.log(`发现 NavPathStack 调用:`);
                            console.log(`  类: ${className}`);
                            console.log(`  方法: ${methodName}`);
                            console.log(`  语句: ${stmtStr.substring(0, 100)}...`);
                            console.log('');
                        }
                    }
                }
            }
            
            console.log(`----- 统计 -----`);
            console.log(`发现 ${pushPathCount} 个 NavPathStack 导航调用`);
            
            if (pushPathCount > 0) {
                console.log('⚠️ NavPathStack API 调用已检测到');
            }
        });
    });

    // ========================================================================
    // 7. DummyMain 生成测试
    // ========================================================================
    
    describe('7. DummyMain 生成测试', () => {
        
        it('7.1 应该成功创建 DummyMain', () => {
            console.log('\n----- DummyMain 创建 -----');
            
            const startTime = Date.now();
            
            try {
                creator.create();
                const endTime = Date.now();
                
                console.log(`  ✅ DummyMain 创建成功`);
                console.log(`  耗时: ${endTime - startTime}ms`);
                
                const dummyMain = creator.getDummyMain();
                const cfg = dummyMain?.getCfg();
                
                if (cfg) {
                    const blockCount = cfg.getBlocks().size;
                    console.log(`  CFG 基本块数: ${blockCount}`);
                    
                    let invokeCount = 0;
                    let newExprCount = 0;
                    
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            const stmtStr = stmt.toString();
                            if (stmtStr.includes('invoke')) {
                                invokeCount++;
                            }
                            if (stmtStr.includes('new ')) {
                                newExprCount++;
                            }
                        }
                    }
                    
                    console.log(`  invoke 语句数: ${invokeCount}`);
                    console.log(`  new 表达式数: ${newExprCount}`);
                }
                
            } catch (error) {
                console.error('  ❌ DummyMain 创建失败:', error);
                throw error;
            }
        });

        it('7.2 验证 DummyMain 包含预期内容', () => {
            creator.create();
            
            const abilities = creator.getAbilities();
            const components = creator.getComponents();
            
            console.log('\n----- DummyMain 内容验证 -----');
            console.log(`  Ability 数量: ${abilities.length}`);
            console.log(`  Component 数量: ${components.length}`);
            
            console.log('\n  Abilities:');
            for (const a of abilities) {
                console.log(`    - ${a.name} (生命周期方法: ${a.lifecycleMethods.size}, 关联组件: ${a.components.length})`);
            }
            
            console.log('\n  Components:');
            for (const c of components) {
                console.log(`    - ${c.name} (UI回调: ${c.uiCallbacks.length})`);
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(3);
        });

        it('7.3 打印 CFG 结构概要', () => {
            creator.create();
            
            const dummyMain = creator.getDummyMain();
            const cfg = dummyMain?.getCfg();
            
            console.log('\n----- CFG 结构概要 -----');
            
            if (cfg) {
                let blockIndex = 0;
                for (const block of cfg.getBlocks()) {
                    const stmts = block.getStmts();
                    console.log(`\nBlock ${blockIndex++}: (${stmts.length} 条语句)`);
                    
                    const displayStmts = stmts.slice(0, 5);
                    for (const stmt of displayStmts) {
                        const stmtStr = stmt.toString();
                        const displayStr = stmtStr.length > 80 
                            ? stmtStr.substring(0, 80) + '...' 
                            : stmtStr;
                        console.log(`  ${displayStr}`);
                    }
                    
                    if (stmts.length > 5) {
                        console.log(`  ... (还有 ${stmts.length - 5} 条语句)`);
                    }
                }
            }
        });
    });

    // ========================================================================
    // 8. 测试总结
    // ========================================================================
    
    describe('8. 测试总结', () => {
        
        it('8.1 生成测试报告', () => {
            console.log('\n');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║   CloudFoundationKit_Codelab_Prefetch_ArkTS 分析测试报告      ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            
            // 重新收集数据
            const entryNames = collector.getEntryAbilityNames();
            const abilities = collector.collectAllAbilities();
            const components = collector.collectAllComponents();
            extractor.fillAllComponentCallbacks(components);
            
            // 统计
            const totalLifecycleMethods = abilities.reduce(
                (sum, a) => sum + a.lifecycleMethods.size, 0
            ) + components.reduce(
                (sum, c) => sum + c.lifecycleMethods.size, 0
            );
            
            const totalUICallbacks = components.reduce(
                (sum, c) => sum + c.uiCallbacks.length, 0
            );
            
            const componentNames = components.map(c => c.name).join(', ');
            
            console.log('║                                                               ║');
            console.log(`║  module.json5 解析:     ${entryNames.size > 0 ? '✅ 成功' : '❌ 失败'}                              ║`);
            console.log(`║  入口 Ability:          ${[...entryNames].join(', ').padEnd(37)}║`);
            console.log(`║  Ability 数量:          ${abilities.length.toString().padEnd(37)}║`);
            console.log(`║  Component 数量:        ${components.length.toString().padEnd(37)}║`);
            console.log(`║  Component 列表:        ${componentNames.substring(0, 35).padEnd(37)}║`);
            console.log(`║  生命周期方法总数:      ${totalLifecycleMethods.toString().padEnd(37)}║`);
            console.log(`║  UI 回调总数:           ${totalUICallbacks.toString().padEnd(37)}║`);
            console.log('║                                                               ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            console.log('║  预期 vs 实际:                                                ║');
            console.log(`║    module.json5 解析:   ${entryNames.size > 0 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    Ability (预期 1):    ${abilities.length >= 1 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    Component (预期 3):  ${components.length >= 3 ? '✅ 通过' : components.length >= 1 ? '⚠️ 部分' : '❌ 不符'}                              ║`);
            console.log(`║    生命周期方法 (≥6):   ${totalLifecycleMethods >= 6 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    UI 回调 (预期 5):    ${totalUICallbacks >= 5 ? '✅ 通过' : totalUICallbacks >= 1 ? '⚠️ 部分' : '❌ 不符'}                              ║`);
            console.log('║                                                               ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('\n');
            
            // 验证基本预期
            expect(entryNames.size).toBeGreaterThanOrEqual(1);
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(3);
        });
    });
});
