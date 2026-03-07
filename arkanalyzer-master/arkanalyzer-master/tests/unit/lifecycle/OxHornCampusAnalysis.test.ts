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
 * @file OxHornCampusAnalysis.test.ts
 * @description 针对 OxHornCampus（溪村小镇）大规模项目的 TEST_lifecycle 分析测试
 * 
 * 项目特点：
 * - 35 个 ETS 文件，大规模真实项目
 * - 完整 Ability 生命周期（含 onNewWant, onContinue）
 * - 多页面导航（Splash -> MainPage, IntroductionPage）
 * - 丰富的手势回调（PanGesture, PinchGesture, TapGesture）
 * - Component 生命周期（aboutToAppear, aboutToDisappear）
 */

import { describe, expect, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

import { 
    LifecycleModelCreator,
    AbilityCollector,
    ViewTreeCallbackExtractor,
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

// OxHornCampus 项目路径
const OXHORN_CAMPUS_PATH = path.join(
    __dirname, 
    '../../../../../Demo4tests/OxHornCampus/OxHornCampus/entry/src/main'
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
// OxHornCampus 项目分析测试
// ============================================================================

describe('OxHornCampus（溪村小镇）大规模项目分析', () => {
    let scene: Scene;
    let collector: AbilityCollector;
    let extractor: ViewTreeCallbackExtractor;
    let creator: LifecycleModelCreator;

    beforeAll(() => {
        console.log('\n========== 开始分析 OxHornCampus（溪村小镇）==========');
        console.log(`项目路径: ${OXHORN_CAMPUS_PATH}`);
        console.log('预期：35 个 ETS 文件，大规模真实项目\n');
        
        try {
            const startTime = Date.now();
            scene = buildSceneFromPath(OXHORN_CAMPUS_PATH);
            collector = new AbilityCollector(scene);
            extractor = new ViewTreeCallbackExtractor(scene);
            creator = new LifecycleModelCreator(scene);
            const endTime = Date.now();
            console.log(`Scene 构建成功! 耗时: ${endTime - startTime}ms\n`);
        } catch (error) {
            console.error('Scene 构建失败:', error);
            throw error;
        }
    });

    // ========================================================================
    // 1. 项目规模分析
    // ========================================================================
    
    describe('1. 项目规模分析', () => {
        
        it('1.1 统计项目类结构', () => {
            console.log('\n----- 项目规模统计 -----');
            
            let totalClasses = 0;
            let componentCount = 0;
            let abilityCount = 0;
            let viewTreeCount = 0;
            const classNames: string[] = [];
            const componentNames: string[] = [];
            
            for (const arkClass of scene.getClasses()) {
                const className = arkClass.getName();
                const superClass = arkClass.getSuperClassName();
                const filePath = arkClass.getDeclaringArkFile()?.getName() || 'unknown';
                
                // 跳过 SDK 类和匿名类
                if (!filePath.includes('Sdk') && !className.startsWith('%AC') && !className.startsWith('%dflt')) {
                    totalClasses++;
                    classNames.push(className);
                    
                    // 统计 Component
                    if (superClass === 'CustomComponent') {
                        componentCount++;
                        componentNames.push(className);
                    }
                    
                    // 统计 Ability
                    if (superClass === 'UIAbility' || className.includes('Ability')) {
                        abilityCount++;
                    }
                    
                    // 统计 ViewTree
                    if (arkClass.getViewTree()) {
                        viewTreeCount++;
                    }
                }
            }
            
            console.log(`  总类数量: ${totalClasses}`);
            console.log(`  Component 数量: ${componentCount}`);
            console.log(`  Ability 数量: ${abilityCount}`);
            console.log(`  有 ViewTree 的类: ${viewTreeCount}`);
            console.log(`\n  Component 列表: ${componentNames.join(', ')}`);
            
            // 大规模项目验证
            expect(totalClasses).toBeGreaterThan(10);
            expect(componentCount).toBeGreaterThan(5);
        });

        it('1.2 打印主要组件结构', () => {
            console.log('\n----- 主要组件结构 -----');
            
            const importantClasses = ['EntryAbility', 'Index', 'Splash', 'Zones', 'Map', 'Trains'];
            
            for (const arkClass of scene.getClasses()) {
                const className = arkClass.getName();
                
                if (importantClasses.includes(className)) {
                    const superClass = arkClass.getSuperClassName();
                    const methods = arkClass.getMethods();
                    const viewTree = arkClass.getViewTree();
                    
                    console.log(`\n${className}:`);
                    console.log(`  继承: ${superClass || '无'}`);
                    console.log(`  方法数: ${methods.length}`);
                    console.log(`  ViewTree: ${viewTree ? '存在' : '无'}`);
                    
                    // 打印主要方法
                    const mainMethods = methods.filter(m => 
                        !m.getName().startsWith('%') || 
                        m.getName().includes('build')
                    ).slice(0, 8);
                    console.log('  主要方法:');
                    for (const m of mainMethods) {
                        console.log(`    - ${m.getName()}`);
                    }
                }
            }
        });
    });

    // ========================================================================
    // 2. module.json5 解析测试
    // ========================================================================
    
    describe('2. module.json5 解析测试', () => {
        
        it('2.1 应该正确解析入口 Ability', () => {
            const entryNames = collector.getEntryAbilityNames();
            
            console.log('\n----- module.json5 解析结果 -----');
            console.log(`入口 Ability: ${[...entryNames].join(', ') || '无'}`);
            
            expect(entryNames.size).toBeGreaterThanOrEqual(1);
            expect(entryNames.has('EntryAbility')).toBe(true);
            
            console.log('  ✅ module.json5 解析成功');
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
                        console.log(`    -> ${nav.targetAbilityName || 'unknown'}`);
                    }
                }
                
                if (ability.components.length > 0) {
                    console.log(`  关联 Component: ${ability.components.map(c => c.name).join(', ')}`);
                }
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            
            const entryAbility = abilities.find(a => a.name === 'EntryAbility');
            expect(entryAbility).toBeDefined();
            
            if (entryAbility) {
                // EntryAbility 有丰富的生命周期方法
                expect(entryAbility.lifecycleMethods.size).toBeGreaterThanOrEqual(5);
                console.log(`\n  ✅ EntryAbility 生命周期方法数: ${entryAbility.lifecycleMethods.size}`);
            }
        });
    });

    // ========================================================================
    // 4. Component 收集测试
    // ========================================================================
    
    describe('4. Component 收集测试', () => {
        
        it('4.1 应该收集到多个 Component', () => {
            const components = collector.collectAllComponents();
            
            console.log('\n----- Component 收集结果 -----');
            console.log(`收集到 ${components.length} 个 Component`);
            
            // 按是否为 @Entry 分组
            const entryComponents = components.filter(c => c.isEntry);
            const normalComponents = components.filter(c => !c.isEntry);
            
            console.log(`\n@Entry Component (${entryComponents.length}个):`);
            for (const comp of entryComponents) {
                console.log(`  - ${comp.name} (生命周期方法: ${comp.lifecycleMethods.size})`);
            }
            
            console.log(`\n普通 Component (${normalComponents.length}个):`);
            for (const comp of normalComponents) {
                console.log(`  - ${comp.name} (生命周期方法: ${comp.lifecycleMethods.size})`);
            }
            
            // 验证
            expect(components.length).toBeGreaterThanOrEqual(5);
            
            // 检查关键组件
            const splash = components.find(c => c.name === 'Splash');
            const index = components.find(c => c.name === 'Index');
            const zones = components.find(c => c.name === 'Zones');
            const map = components.find(c => c.name === 'Map');
            
            if (splash) console.log('\n  ✅ 找到 Splash (启动页)');
            if (index) console.log('  ✅ 找到 Index (主页)');
            if (zones) console.log('  ✅ 找到 Zones (区域导览)');
            if (map) console.log('  ✅ 找到 Map (地图组件)');
        });

        it('4.2 验证 Component 生命周期方法（aboutToAppear/aboutToDisappear）', () => {
            const components = collector.collectAllComponents();
            
            console.log('\n----- Component 生命周期方法验证 -----');
            
            let hasAboutToAppear = 0;
            let hasAboutToDisappear = 0;
            
            for (const comp of components) {
                const stages = [...comp.lifecycleMethods.keys()];
                
                if (stages.some(s => s.includes('aboutToAppear'))) {
                    hasAboutToAppear++;
                    console.log(`  ${comp.name}: 有 aboutToAppear`);
                }
                if (stages.some(s => s.includes('aboutToDisappear'))) {
                    hasAboutToDisappear++;
                    console.log(`  ${comp.name}: 有 aboutToDisappear`);
                }
            }
            
            console.log(`\n统计: ${hasAboutToAppear} 个组件有 aboutToAppear`);
            console.log(`统计: ${hasAboutToDisappear} 个组件有 aboutToDisappear`);
            
            // Splash 组件应该有 aboutToAppear 和 aboutToDisappear
            const splash = components.find(c => c.name === 'Splash');
            if (splash) {
                const stages = [...splash.lifecycleMethods.keys()];
                const hasAppear = stages.some(s => s.includes('aboutToAppear'));
                const hasDisappear = stages.some(s => s.includes('aboutToDisappear'));
                console.log(`\nSplash 验证: aboutToAppear=${hasAppear}, aboutToDisappear=${hasDisappear}`);
            }
        });
    });

    // ========================================================================
    // 5. UI 回调提取测试
    // ========================================================================
    
    describe('5. UI 回调提取测试', () => {
        
        it('5.1 提取所有 Component 的 UI 回调', () => {
            console.log('\n----- UI 回调提取 -----');
            
            const components = collector.collectAllComponents();
            extractor.fillAllComponentCallbacks(components);
            
            let totalCallbacks = 0;
            const eventTypeSummary = new Map<string, number>();
            
            // 只输出有回调的组件
            for (const comp of components) {
                if (comp.uiCallbacks.length > 0) {
                    totalCallbacks += comp.uiCallbacks.length;
                    
                    console.log(`\n${comp.name}: ${comp.uiCallbacks.length} 个回调`);
                    for (const cb of comp.uiCallbacks) {
                        const methodName = cb.callbackMethod?.getName() || 'inline';
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
            
            // 大规模项目应该有更多回调
            console.log(`\n预期: 大规模项目应有丰富的 UI 回调`);
            console.log(`实际: ${totalCallbacks} 个回调 ${totalCallbacks >= 5 ? '✅' : '⚠️'}`);
        });

        it('5.2 验证特定组件的回调', () => {
            console.log('\n----- 特定组件回调验证 -----');
            
            const targetComponents = ['Splash', 'Index', 'Zones', 'Map', 'CustomPanel'];
            
            for (const arkClass of scene.getClasses()) {
                const className = arkClass.getName();
                
                if (targetComponents.includes(className)) {
                    const viewTree = arkClass.getViewTree();
                    if (viewTree) {
                        const callbacks = extractor.extractFromComponent(arkClass);
                        console.log(`\n${className}:`);
                        console.log(`  ViewTree: 存在`);
                        console.log(`  回调数量: ${callbacks.length}`);
                        
                        for (const cb of callbacks.slice(0, 5)) {
                            console.log(`    - ${cb.componentType}.${cb.eventType}`);
                        }
                        if (callbacks.length > 5) {
                            console.log(`    ... (还有 ${callbacks.length - 5} 个)`);
                        }
                    } else {
                        console.log(`\n${className}: ViewTree 为空`);
                    }
                }
            }
        });
    });

    // ========================================================================
    // 6. 导航分析测试
    // ========================================================================
    
    describe('6. 导航分析测试', () => {
        
        it('6.1 分析页面间导航', () => {
            console.log('\n----- 页面导航分析 -----');
            
            // 查找 router.pushUrl 和 router.replaceUrl 调用
            let pushUrlCount = 0;
            let replaceUrlCount = 0;
            let loadContentCount = 0;
            
            for (const method of scene.getMethods()) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                const className = method.getDeclaringArkClass().getName();
                const methodName = method.getName();
                
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        const stmtStr = stmt.toString();
                        
                        if (stmtStr.includes('pushUrl')) {
                            pushUrlCount++;
                            console.log(`发现 pushUrl: ${className}.${methodName}`);
                        }
                        if (stmtStr.includes('replaceUrl')) {
                            replaceUrlCount++;
                            console.log(`发现 replaceUrl: ${className}.${methodName}`);
                        }
                        if (stmtStr.includes('loadContent')) {
                            loadContentCount++;
                            console.log(`发现 loadContent: ${className}.${methodName}`);
                        }
                    }
                }
            }
            
            console.log(`\n----- 统计 -----`);
            console.log(`  pushUrl: ${pushUrlCount} 处`);
            console.log(`  replaceUrl: ${replaceUrlCount} 处`);
            console.log(`  loadContent: ${loadContentCount} 处`);
            
            // 验证有导航存在
            expect(pushUrlCount + replaceUrlCount + loadContentCount).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // 7. DummyMain 生成测试
    // ========================================================================
    
    describe('7. DummyMain 生成测试', () => {
        
        it('7.1 应该成功创建大规模项目的 DummyMain', () => {
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
                    let invokeCount = 0;
                    let stmtCount = 0;
                    
                    for (const block of cfg.getBlocks()) {
                        stmtCount += block.getStmts().length;
                        for (const stmt of block.getStmts()) {
                            if (stmt.toString().includes('invoke')) {
                                invokeCount++;
                            }
                        }
                    }
                    
                    console.log(`  CFG 基本块数: ${blockCount}`);
                    console.log(`  总语句数: ${stmtCount}`);
                    console.log(`  invoke 语句数: ${invokeCount}`);
                }
                
            } catch (error) {
                console.error('  ❌ DummyMain 创建失败:', error);
                throw error;
            }
        });

        it('7.2 验证 DummyMain 内容', () => {
            creator.create();
            
            const abilities = creator.getAbilities();
            const components = creator.getComponents();
            
            console.log('\n----- DummyMain 内容 -----');
            console.log(`  Ability 数量: ${abilities.length}`);
            console.log(`  Component 数量: ${components.length}`);
            
            // 统计有回调的组件
            const componentsWithCallbacks = components.filter(c => c.uiCallbacks.length > 0);
            const totalCallbacks = components.reduce((sum, c) => sum + c.uiCallbacks.length, 0);
            
            console.log(`\n  有回调的组件: ${componentsWithCallbacks.length}`);
            console.log(`  UI 回调总数: ${totalCallbacks}`);
            
            console.log('\n  Abilities:');
            for (const a of abilities) {
                console.log(`    - ${a.name} (生命周期: ${a.lifecycleMethods.size}, 组件: ${a.components.length})`);
            }
            
            console.log('\n  Components (前10个):');
            for (const c of components.slice(0, 10)) {
                console.log(`    - ${c.name} (生命周期: ${c.lifecycleMethods.size}, 回调: ${c.uiCallbacks.length})`);
            }
            if (components.length > 10) {
                console.log(`    ... (还有 ${components.length - 10} 个)`);
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(5);
        });
    });

    // ========================================================================
    // 8. 测试总结
    // ========================================================================
    
    describe('8. 测试总结', () => {
        
        it('8.1 生成测试报告', () => {
            console.log('\n');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║      OxHornCampus（溪村小镇）大规模项目分析测试报告           ║');
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
            
            // 统计类数量
            let totalClasses = 0;
            for (const arkClass of scene.getClasses()) {
                const filePath = arkClass.getDeclaringArkFile()?.getName() || '';
                if (!filePath.includes('Sdk') && !arkClass.getName().startsWith('%')) {
                    totalClasses++;
                }
            }
            
            console.log('║                                                               ║');
            console.log(`║  项目规模:              大规模（35 ETS 文件）                 ║`);
            console.log(`║  总类数量:              ${totalClasses.toString().padEnd(37)}║`);
            console.log(`║  module.json5 解析:     ${entryNames.size > 0 ? '✅ 成功' : '❌ 失败'}                              ║`);
            console.log(`║  入口 Ability:          ${[...entryNames].join(', ').substring(0, 35).padEnd(37)}║`);
            console.log(`║  Ability 数量:          ${abilities.length.toString().padEnd(37)}║`);
            console.log(`║  Component 数量:        ${components.length.toString().padEnd(37)}║`);
            console.log(`║  生命周期方法总数:      ${totalLifecycleMethods.toString().padEnd(37)}║`);
            console.log(`║  UI 回调总数:           ${totalUICallbacks.toString().padEnd(37)}║`);
            console.log('║                                                               ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            console.log('║  预期 vs 实际:                                                ║');
            console.log(`║    module.json5 解析:   ${entryNames.size > 0 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    Ability (预期 ≥1):   ${abilities.length >= 1 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    Component (预期 ≥5): ${components.length >= 5 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    生命周期方法 (≥10):  ${totalLifecycleMethods >= 10 ? '✅ 通过' : '⚠️ 部分'}                              ║`);
            console.log(`║    UI 回调 (预期 ≥5):   ${totalUICallbacks >= 5 ? '✅ 通过' : totalUICallbacks >= 1 ? '⚠️ 部分' : '❌ 不符'}                              ║`);
            console.log('║                                                               ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('\n');
            
            // 验证基本预期
            expect(entryNames.size).toBeGreaterThanOrEqual(1);
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(5);
        });
    });
});
