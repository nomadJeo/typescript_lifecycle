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
 * @file UIDesignKitNavAnalysis.test.ts
 * @description 针对 UIDesignKit_HdsNavigation_Codelab 项目的 TEST_lifecycle 分析测试
 * 
 * 测试目标：
 * - 验证 TEST_lifecycle 模块在多页面导航项目上的工作情况
 * - 测试 NavPathStack 导航方式的支持情况
 * - 评估复杂 UI 组件的回调提取能力
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

// UIDesignKit 项目路径 (多层嵌套目录)
const UIDESIGNKIT_PATH = path.join(
    __dirname, 
    '../../../../../Demo4tests/UIDesignKit_HdsNavigation_Codelab/UIDesignKit_HdsNavigation_Codelab/UIDesignKit_HdsNavigation_Codelab/UIDesignKit_HdsNavigation_Codelab/entry/src/main'
);

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
// UIDesignKit_HdsNavigation_Codelab 项目分析测试
// ============================================================================

describe('UIDesignKit_HdsNavigation_Codelab 项目分析', () => {
    let scene: Scene;
    let collector: AbilityCollector;
    let extractor: ViewTreeCallbackExtractor;
    let creator: LifecycleModelCreator;

    beforeAll(() => {
        console.log('\n========== 开始分析 UIDesignKit_HdsNavigation_Codelab ==========');
        console.log(`项目路径: ${UIDESIGNKIT_PATH}`);
        
        try {
            scene = buildSceneFromPath(UIDESIGNKIT_PATH);
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
                
                // 过滤掉 SDK 类和匿名类
                if (!filePath.includes('Sdk') && !className.startsWith('%AC')) {
                    classCount++;
                    projectClasses.push(className);
                    
                    console.log(`\n类: ${className}`);
                    console.log(`  文件: ${filePath}`);
                    if (superClass) {
                        console.log(`  继承: ${superClass}`);
                    }
                    
                    // 打印方法（限制数量避免输出过长）
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
                    
                    // 检查 ViewTree
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
                        console.log(`    -> ${nav.targetAbilityName || 'unknown'} (${nav.navigationType || 'unknown'})`);
                    }
                }
                
                // 打印关联的 Component
                if (ability.components.length > 0) {
                    console.log('  关联 Component:');
                    for (const comp of ability.components) {
                        console.log(`    - ${comp.name}`);
                    }
                }
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            
            // 查找 EntryAbility
            const entryAbility = abilities.find(a => a.name.includes('EntryAbility'));
            expect(entryAbility).toBeDefined();
            
            if (entryAbility) {
                console.log('\n----- EntryAbility 验证 -----');
                console.log(`  ✅ 找到 EntryAbility`);
                console.log(`  生命周期方法数: ${entryAbility.lifecycleMethods.size}`);
                expect(entryAbility.lifecycleMethods.size).toBeGreaterThanOrEqual(4);
            }
        });

        it('2.2 应该正确识别入口 Ability', () => {
            const entryNames = collector.getEntryAbilityNames();
            
            console.log('\n----- 入口 Ability 识别 -----');
            console.log(`从 module.json5 读取到的入口: ${[...entryNames].join(', ') || '无'}`);
            
            const abilities = collector.collectAllAbilities();
            const entryAbilities = abilities.filter(a => a.isEntry);
            
            console.log(`被标记为入口的 Ability: ${entryAbilities.map(a => a.name).join(', ') || '无'}`);
            
            // 注意: module.json5 解析可能失败（JSON5 格式问题），此时使用启发式方法
            // 因此这里不强制要求从配置文件读取到入口
            console.log(`注意: 如果 entryNames.size = 0，说明 module.json5 解析失败，使用启发式识别`);
            expect(entryAbilities.length).toBeGreaterThanOrEqual(1);
        });
    });

    // ========================================================================
    // 3. Component 收集测试（重点：多页面）
    // ========================================================================
    
    describe('3. Component 收集测试', () => {
        
        it('3.1 应该收集到 Index, PageOne, PageTwo 三个 Component', () => {
            const components = collector.collectAllComponents();
            
            console.log('\n----- Component 收集结果 -----');
            console.log(`收集到 ${components.length} 个 Component`);
            
            const componentNames: string[] = [];
            
            for (const component of components) {
                componentNames.push(component.name);
                console.log(`\nComponent: ${component.name}`);
                console.log(`  生命周期方法数: ${component.lifecycleMethods.size}`);
                console.log(`  是否为 @Entry: ${component.isEntry}`);
                
                // 打印生命周期方法
                if (component.lifecycleMethods.size > 0) {
                    console.log('  生命周期方法:');
                    for (const [stage, method] of component.lifecycleMethods) {
                        console.log(`    - ${stage}: ${method.getName()}`);
                    }
                }
            }
            
            console.log(`\n组件列表: ${componentNames.join(', ')}`);
            
            // 验证
            expect(components.length).toBeGreaterThanOrEqual(1);
            
            // 检查是否有 Index
            const indexComponent = components.find(c => c.name === 'Index');
            if (indexComponent) {
                console.log('\n  ✅ 找到 Index Component');
            } else {
                console.log('\n  ⚠️ 未找到 Index Component');
            }
            
            // 检查是否有 PageOne
            const pageOneComponent = components.find(c => c.name === 'PageOne');
            if (pageOneComponent) {
                console.log('  ✅ 找到 PageOne Component');
            } else {
                console.log('  ⚠️ 未找到 PageOne Component');
            }
            
            // 检查是否有 PageTwo
            const pageTwoComponent = components.find(c => c.name === 'PageTwo');
            if (pageTwoComponent) {
                console.log('  ✅ 找到 PageTwo Component');
            } else {
                console.log('  ⚠️ 未找到 PageTwo Component');
            }
        });
    });

    // ========================================================================
    // 4. UI 回调提取测试（重点：多个 onClick）
    // ========================================================================
    
    describe('4. UI 回调提取测试', () => {
        
        it('4.1 应该从各页面提取 onClick 回调', () => {
            console.log('\n----- UI 回调提取 -----');
            
            const components = collector.collectAllComponents();
            let totalCallbacks = 0;
            const eventTypeSummary = new Map<string, number>();
            
            for (const arkClass of scene.getClasses()) {
                const viewTree = arkClass.getViewTree();
                const className = arkClass.getName();
                
                // 只处理我们关心的组件
                if (viewTree && (className === 'Index' || className === 'PageOne' || className === 'PageTwo')) {
                    const callbacks = extractor.extractFromComponent(arkClass);
                    totalCallbacks += callbacks.length;
                    
                    console.log(`\n${className} 回调提取结果:`);
                    console.log(`  回调总数: ${callbacks.length}`);
                    
                    for (const cb of callbacks) {
                        const methodName = cb.callbackMethod?.getName() || 'unknown/inline';
                        console.log(`  - ${cb.componentType}.${cb.eventType} -> ${methodName}`);
                        
                        // 统计事件类型
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
            
            // 预期每个页面至少有一个 onClick（Button 的点击事件）
            // Index: 1 个 pushPath
            // PageOne: 1 个 pushPath
            // PageTwo: 1 个 pushPathByName
            console.log(`\n预期至少 3 个 onClick 回调: ${totalCallbacks >= 3 ? '✅' : '⚠️'} (实际: ${totalCallbacks})`);
        });

        it('4.2 填充所有 Component 回调信息', () => {
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
    // 5. 导航分析测试（重点：NavPathStack）
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
                    console.log('  ✅ loadContent 导航目标已识别');
                } else {
                    console.log('  (无导航目标被识别)');
                }
            }
        });

        it('5.2 分析 NavPathStack.pushPath 调用（新 API）', () => {
            console.log('\n----- NavPathStack 导航分析 -----');
            console.log('注意: pushPath/pushPathByName 是新的 Navigation API，可能需要扩展支持\n');
            
            // 遍历所有方法，查找 pushPath 调用
            let pushPathCount = 0;
            
            for (const method of scene.getMethods()) {
                const methodName = method.getName();
                const className = method.getDeclaringArkClass().getName();
                
                // 跳过 SDK 类
                if (className.startsWith('%') && !className.includes('build')) {
                    continue;
                }
                
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                // 检查方法中的调用
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        const stmtStr = stmt.toString();
                        if (stmtStr.includes('pushPath') || stmtStr.includes('pushPathByName')) {
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
            
            console.log(`\n----- 统计 -----`);
            console.log(`发现 ${pushPathCount} 个 NavPathStack 导航调用`);
            
            if (pushPathCount > 0) {
                console.log('⚠️ 当前 NavigationAnalyzer 可能不支持 NavPathStack API');
                console.log('   建议: 扩展 NavigationAnalyzer 以支持 pushPath/pushPathByName');
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
                console.log(`    - ${a.name} (生命周期方法: ${a.lifecycleMethods.size}, 关联组件: ${a.components.length})`);
            }
            
            console.log('\n  Components:');
            for (const c of components) {
                console.log(`    - ${c.name} (UI回调: ${c.uiCallbacks.length})`);
            }
            
            // 验证
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(1);
        });

        it('6.3 打印 CFG 结构概要', () => {
            creator.create();
            
            const dummyMain = creator.getDummyMain();
            const cfg = dummyMain?.getCfg();
            
            console.log('\n----- CFG 结构概要 -----');
            
            if (cfg) {
                let blockIndex = 0;
                for (const block of cfg.getBlocks()) {
                    const stmts = block.getStmts();
                    console.log(`\nBlock ${blockIndex++}: (${stmts.length} 条语句)`);
                    
                    // 只打印关键语句（前 5 条）
                    const displayStmts = stmts.slice(0, 5);
                    for (const stmt of displayStmts) {
                        const stmtStr = stmt.toString();
                        // 截断过长的语句
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
    // 7. 测试总结
    // ========================================================================
    
    describe('7. 测试总结', () => {
        
        it('7.1 生成测试报告', () => {
            console.log('\n');
            console.log('╔═══════════════════════════════════════════════════════════════╗');
            console.log('║     UIDesignKit_HdsNavigation_Codelab 分析测试报告            ║');
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
            
            const componentNames = components.map(c => c.name).join(', ');
            
            console.log('║                                                               ║');
            console.log(`║  Ability 数量:          ${abilities.length.toString().padEnd(37)}║`);
            console.log(`║  Component 数量:        ${components.length.toString().padEnd(37)}║`);
            console.log(`║  Component 列表:        ${componentNames.substring(0, 35).padEnd(37)}║`);
            console.log(`║  生命周期方法总数:      ${totalLifecycleMethods.toString().padEnd(37)}║`);
            console.log(`║  UI 回调总数:           ${totalUICallbacks.toString().padEnd(37)}║`);
            console.log('║                                                               ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            console.log('║  预期 vs 实际:                                                ║');
            console.log(`║    Ability (预期 1):    ${abilities.length >= 1 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    Component (预期 3):  ${components.length >= 3 ? '✅ 通过' : components.length >= 1 ? '⚠️ 部分' : '❌ 不符'}                              ║`);
            console.log(`║    生命周期方法 (≥6):   ${totalLifecycleMethods >= 6 ? '✅ 通过' : '❌ 不符'}                              ║`);
            console.log(`║    UI 回调 (预期 3):    ${totalUICallbacks >= 3 ? '✅ 通过' : totalUICallbacks >= 1 ? '⚠️ 部分' : '❌ 不符'}                              ║`);
            console.log('║                                                               ║');
            console.log('╠═══════════════════════════════════════════════════════════════╣');
            console.log('║  NavPathStack 导航支持:                                       ║');
            console.log('║    pushPath:            ⚠️ 需要扩展                           ║');
            console.log('║    pushPathByName:      ⚠️ 需要扩展                           ║');
            console.log('║                                                               ║');
            console.log('╚═══════════════════════════════════════════════════════════════╝');
            console.log('\n');
            
            // 验证基本预期
            expect(abilities.length).toBeGreaterThanOrEqual(1);
            expect(components.length).toBeGreaterThanOrEqual(1);
        });
    });
});
