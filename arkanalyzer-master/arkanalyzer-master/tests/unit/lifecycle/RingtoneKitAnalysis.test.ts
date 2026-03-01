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
 * @file RingtoneKitAnalysis.test.ts
 * @description 针对 RingtoneKit_Codelab_Demo 项目的 TEST_lifecycle 分析测试
 * 
 * 测试目标：
 * - 验证 TEST_lifecycle 模块在真实鸿蒙项目上的工作情况
 * - 收集分析结果，评估模块的可靠性
 */

import { describe, expect, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

// 导入 TEST_lifecycle 模块
import { 
    LifecycleModelCreator,
    AbilityCollector,
    ViewTreeCallbackExtractor,
    NavigationAnalyzer,
    AbilityLifecycleStage,
    ComponentLifecycleStage,
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

// RingtoneKit 项目路径 (相对于 typescript 根目录)
const RINGTONE_KIT_PATH = path.join(__dirname, '../../../../../Demo4tests/RingtoneKit_Codelab_Demo/entry/src/main');

/**
 * 构建 Scene 的辅助函数
 */
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
// RingtoneKit 项目分析测试
// ============================================================================

describe('RingtoneKit_Codelab_Demo 项目分析', () => {
    let scene: Scene;
    let collector: AbilityCollector;
    let extractor: ViewTreeCallbackExtractor;
    let creator: LifecycleModelCreator;

    beforeAll(() => {
        console.log('\n========== 开始分析 RingtoneKit_Codelab_Demo ==========');
        console.log(`项目路径: ${RINGTONE_KIT_PATH}`);
        
        try {
            scene = buildSceneFromPath(RINGTONE_KIT_PATH);
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
            for (const arkClass of scene.getClasses()) {
                const className = arkClass.getName();
                const superClass = arkClass.getSuperClassName();
                const filePath = arkClass.getDeclaringArkFile()?.getName() || 'unknown';
                
                // 过滤掉 SDK 类，只显示项目内的类
                if (!filePath.includes('Sdk') && !className.startsWith('%')) {
                    classCount++;
                    console.log(`\n类: ${className}`);
                    console.log(`  文件: ${filePath}`);
                    if (superClass) {
                        console.log(`  继承: ${superClass}`);
                    }
                    
                    // 打印方法
                    const methods = arkClass.getMethods();
                    if (methods.length > 0) {
                        console.log('  方法:');
                        for (const method of methods) {
                            console.log(`    - ${method.getName()}`);
                        }
                    }
                    
                    // 检查 ViewTree
                    const viewTree = arkClass.getViewTree();
                    if (viewTree) {
                        console.log('  ViewTree: 存在');
                    }
                }
            }
            
            console.log(`\n总计: ${classCount} 个项目类`);
            expect(classCount).toBeGreaterThan(0);
        });
    });

    // ========================================================================
    // 2. Ability 收集测试
    // ========================================================================
    
    describe('2. Ability 收集测试', () => {
        
        it('2.1 应该收集到 EntryAbility', () => {
            const abilities = collector.collectAllAbilities();
            
            console.log('\n----- Ability 收集结果 -----');
            console.log(`收集到 ${abilities.length} 个 Ability`);
            
            for (const ability of abilities) {
                console.log(`\nAbility: ${ability.name}`);
                console.log(`  是否为入口: ${ability.isEntry}`);
                console.log(`  生命周期方法数: ${ability.lifecycleMethods.size}`);
                
                // 打印生命周期方法详情
                console.log('  生命周期方法:');
                for (const [stage, method] of ability.lifecycleMethods) {
                    console.log(`    - ${stage}: ${method.getName()}`);
                }
                
                // 打印导航目标
                if (ability.navigationTargets.length > 0) {
                    console.log('  导航目标:');
                    for (const nav of ability.navigationTargets) {
                        console.log(`    -> ${nav.targetAbilityName || 'unknown'}`);
                    }
                }
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            
            // 查找 EntryAbility
            const entryAbility = abilities.find(a => a.name.includes('EntryAbility'));
            expect(entryAbility).toBeDefined();
            
            if (entryAbility) {
                // 验证生命周期方法
                console.log('\n----- EntryAbility 生命周期方法验证 -----');
                const expectedMethods = ['onCreate', 'onDestroy', 'onWindowStageCreate', 
                                         'onWindowStageDestroy', 'onForeground', 'onBackground'];
                
                for (const methodName of expectedMethods) {
                    let found = false;
                    for (const [stage, method] of entryAbility.lifecycleMethods) {
                        if (method.getName() === methodName) {
                            found = true;
                            console.log(`  ✅ ${methodName}`);
                            break;
                        }
                    }
                    if (!found) {
                        console.log(`  ❌ ${methodName} - 未找到`);
                    }
                }
            }
        });

        it('2.2 应该正确识别入口 Ability', () => {
            const entryNames = collector.getEntryAbilityNames();
            
            console.log('\n----- 入口 Ability 识别 -----');
            console.log(`从 module.json5 读取到的入口: ${[...entryNames].join(', ') || '无'}`);
            
            // EntryAbility 应该被标记为入口
            const abilities = collector.collectAllAbilities();
            const entryAbilities = abilities.filter(a => a.isEntry);
            
            console.log(`被标记为入口的 Ability: ${entryAbilities.map(a => a.name).join(', ') || '无'}`);
        });
    });

    // ========================================================================
    // 3. Component 收集测试
    // ========================================================================
    
    describe('3. Component 收集测试', () => {
        
        it('3.1 应该收集到 Index Component', () => {
            const components = collector.collectAllComponents();
            
            console.log('\n----- Component 收集结果 -----');
            console.log(`收集到 ${components.length} 个 Component`);
            
            for (const component of components) {
                console.log(`\nComponent: ${component.name}`);
                console.log(`  生命周期方法数: ${component.lifecycleMethods.size}`);
                
                // 打印生命周期方法
                if (component.lifecycleMethods.size > 0) {
                    console.log('  生命周期方法:');
                    for (const [stage, method] of component.lifecycleMethods) {
                        console.log(`    - ${stage}: ${method.getName()}`);
                    }
                }
            }
            
            // 验证
            expect(components.length).toBeGreaterThanOrEqual(1);
            
            // 查找 Index
            const indexComponent = components.find(c => c.name === 'Index');
            if (indexComponent) {
                console.log('\n----- Index Component 验证 -----');
                console.log(`  ✅ 找到 Index Component`);
                
                // 验证 aboutToAppear
                const hasAboutToAppear = indexComponent.lifecycleMethods.has(
                    ComponentLifecycleStage.ABOUT_TO_APPEAR
                );
                console.log(`  aboutToAppear: ${hasAboutToAppear ? '✅' : '❌'}`);
            }
        });
    });

    // ========================================================================
    // 4. UI 回调提取测试
    // ========================================================================
    
    describe('4. UI 回调提取测试', () => {
        
        it('4.1 应该提取到 onClick 和 onChange 回调', () => {
            console.log('\n----- UI 回调提取 -----');
            
            let totalCallbacks = 0;
            const eventTypes = new Set<string>();
            
            for (const arkClass of scene.getClasses()) {
                const viewTree = arkClass.getViewTree();
                if (viewTree && arkClass.getName() === 'Index') {
                    const callbacks = extractor.extractFromComponent(arkClass);
                    totalCallbacks = callbacks.length;
                    
                    console.log(`\nIndex Component 回调提取结果:`);
                    console.log(`  回调总数: ${callbacks.length}`);
                    
                    for (const cb of callbacks) {
                        eventTypes.add(cb.eventType);
                        const methodName = cb.callbackMethod?.getName() || 'unknown/inline';
                        console.log(`  - ${cb.componentType}.${cb.eventType} -> ${methodName}`);
                    }
                }
            }
            
            console.log(`\n识别的事件类型: ${[...eventTypes].join(', ') || '无'}`);
            
            // 预期应该有 onChange (TextInput) 和 onClick (Button)
            console.log('\n----- 预期 vs 实际 -----');
            console.log(`  预期 onChange: ${eventTypes.has('onChange') ? '✅' : '❌'}`);
            console.log(`  预期 onClick: ${eventTypes.has('onClick') ? '✅' : '❌'}`);
        });

        it('4.2 填充 Component 回调信息', () => {
            const components = collector.collectAllComponents();
            extractor.fillAllComponentCallbacks(components);
            
            console.log('\n----- Component 回调填充结果 -----');
            
            for (const comp of components) {
                console.log(`\n${comp.name}:`);
                console.log(`  回调数量: ${comp.uiCallbacks.length}`);
                
                for (const cb of comp.uiCallbacks) {
                    const methodName = cb.callbackMethod?.getName() || 'inline';
                    console.log(`    - ${cb.componentType}.${cb.eventType} -> ${methodName}`);
                }
            }
        });
    });

    // ========================================================================
    // 5. 导航分析测试
    // ========================================================================
    
    describe('5. 导航分析测试', () => {
        
        it('5.1 分析 loadContent 调用', () => {
            console.log('\n----- 导航/页面加载分析 -----');
            
            const abilities = collector.collectAllAbilities();
            
            for (const ability of abilities) {
                console.log(`\n${ability.name} 的导航目标:`);
                
                if (ability.navigationTargets.length > 0) {
                    for (const nav of ability.navigationTargets) {
                        console.log(`  类型: ${nav.navigationType || 'unknown'}`);
                        console.log(`  目标: ${nav.targetAbilityName || 'unknown'}`);
                    }
                } else {
                    console.log('  (无导航目标被识别)');
                }
            }
            
            // 预期：EntryAbility 应该有 loadContent('pages/Index') 的导航目标
            const entryAbility = abilities.find(a => a.name.includes('EntryAbility'));
            if (entryAbility && entryAbility.navigationTargets.length > 0) {
                console.log('\n  ✅ 导航目标已识别');
            } else {
                console.log('\n  ⚠️ 未识别到导航目标 (loadContent 可能未被解析)');
            }
        });
    });

    // ========================================================================
    // 6. 端到端测试 - DummyMain 生成
    // ========================================================================
    
    describe('6. DummyMain 生成测试', () => {
        
        it('6.1 应该成功创建 DummyMain', () => {
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
                    
                    // 统计语句
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

        it('6.2 验证 DummyMain 包含预期内容', () => {
            creator.create();
            
            const abilities = creator.getAbilities();
            const components = creator.getComponents();
            
            console.log('\n----- DummyMain 内容验证 -----');
            console.log(`  Ability 数量: ${abilities.length}`);
            console.log(`  Component 数量: ${components.length}`);
            
            // 打印详细信息
            console.log('\n  Abilities:');
            for (const a of abilities) {
                console.log(`    - ${a.name} (生命周期方法: ${a.lifecycleMethods.size})`);
            }
            
            console.log('\n  Components:');
            for (const c of components) {
                console.log(`    - ${c.name} (UI回调: ${c.uiCallbacks.length})`);
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(1);
        });

        it('6.3 打印 CFG 结构详情', () => {
            creator.create();
            
            const dummyMain = creator.getDummyMain();
            const cfg = dummyMain?.getCfg();
            
            console.log('\n----- CFG 结构详情 -----');
            
            if (cfg) {
                let blockIndex = 0;
                for (const block of cfg.getBlocks()) {
                    console.log(`\nBlock ${blockIndex++}:`);
                    
                    const stmts = block.getStmts();
                    if (stmts.length === 0) {
                        console.log('  (空块)');
                    } else {
                        for (const stmt of stmts) {
                            const stmtStr = stmt.toString();
                            // 截断过长的语句
                            const displayStr = stmtStr.length > 100 
                                ? stmtStr.substring(0, 100) + '...' 
                                : stmtStr;
                            console.log(`  ${displayStr}`);
                        }
                    }
                }
            }
        });
    });

    // ========================================================================
    // 7. 测试总结
    // ========================================================================
    
    describe('7. 测试总结', () => {
        
        it('7.1 生成测试报告', () => {
            console.log('\n');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║         RingtoneKit_Codelab_Demo 分析测试报告                 ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            
            // 重新收集数据
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
            
            console.log('║                                                               ║');
            console.log(`║  Ability 数量:          ${abilities.length.toString().padEnd(37)}║`);
            console.log(`║  Component 数量:        ${components.length.toString().padEnd(37)}║`);
            console.log(`║  生命周期方法总数:      ${totalLifecycleMethods.toString().padEnd(37)}║`);
            console.log(`║  UI 回调总数:           ${totalUICallbacks.toString().padEnd(37)}║`);
            console.log('║                                                               ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            console.log('║  预期 vs 实际:                                                ║');
            console.log(`║    Ability (预期 1):    ${abilities.length === 1 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    Component (预期 1):  ${components.length >= 1 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    生命周期方法 (≥6):   ${totalLifecycleMethods >= 6 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    UI 回调 (预期 2):    ${totalUICallbacks >= 2 ? '✅ 通过' : totalUICallbacks >= 1 ? '⚠️ 部分' : '❌ 不符'}                              ║`);
            console.log('║                                                               ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('\n');
            
            // 验证基本预期
            expect(abilities.length).toBe(1);
            expect(components.length).toBeGreaterThanOrEqual(1);
        });
    });
});
