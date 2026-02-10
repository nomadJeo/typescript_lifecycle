/*
 * Lambda 表达式解析测试
 * 目标：深入分析 ArkAnalyzer 如何处理 Lambda/箭头函数
 */

import { describe, expect, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';
import { 
    ViewTreeCallbackExtractor,
    AbilityCollector,
} from '../../../src/TEST_lifecycle';

const SDK_DIR = path.join(__dirname, '../../resources/Sdk');
const sdk: Sdk = { name: '', path: SDK_DIR, moduleName: '' };

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

describe('Lambda 表达式深度分析', () => {
    
    describe('1. Lambda 转换机制分析', () => {
        let scene: Scene;
        
        beforeAll(() => {
            scene = buildScene('simple');
        });

        it('1.1 分析 Index 组件的所有方法', () => {
            console.log('\n========== Lambda 转换分析 ==========\n');
            
            for (const arkClass of scene.getClasses()) {
                if (arkClass.getName() === 'Index') {
                    console.log('Index 组件的方法列表：');
                    console.log('─'.repeat(50));
                    
                    for (const method of arkClass.getMethods()) {
                        const methodName = method.getName();
                        const params = method.getParameters();
                        const paramStr = params.map(p => `${p.getName()}: ${p.getType()}`).join(', ');
                        
                        // 检查是否是 Lambda 生成的方法
                        const isLambda = methodName.startsWith('%AM') || methodName.includes('$');
                        const marker = isLambda ? ' [Lambda]' : '';
                        
                        console.log(`  ${methodName}(${paramStr})${marker}`);
                        
                        // 如果是 Lambda 方法，打印其 CFG 内容
                        if (isLambda) {
                            const cfg = method.getCfg();
                            if (cfg) {
                                console.log('    CFG 语句：');
                                for (const block of cfg.getBlocks()) {
                                    for (const stmt of block.getStmts()) {
                                        console.log(`      ${stmt.toString()}`);
                                    }
                                }
                            }
                        }
                    }
                    console.log('─'.repeat(50));
                }
            }
        });

        it('1.2 分析 ViewTree 中的回调属性', () => {
            console.log('\n========== ViewTree 回调属性分析 ==========\n');
            
            for (const arkClass of scene.getClasses()) {
                if (arkClass.getName() === 'Index') {
                    const viewTree = arkClass.getViewTree();
                    if (!viewTree) {
                        console.log('ViewTree 不存在');
                        return;
                    }
                    
                    const root = viewTree.getRoot();
                    if (!root) {
                        console.log('ViewTree root 不存在');
                        return;
                    }
                    
                    // 递归遍历 ViewTree
                    const analyzeNode = (node: any, depth: number = 0) => {
                        const indent = '  '.repeat(depth);
                        const name = node.name || 'unknown';
                        console.log(`${indent}${name}:`);
                        
                        // 分析属性
                        if (node.attributes) {
                            for (const [attrName, attrValue] of node.attributes) {
                                if (attrName.startsWith('on')) {
                                    console.log(`${indent}  ${attrName}:`);
                                    
                                    // attrValue 结构: [Stmt, Value[]]
                                    if (Array.isArray(attrValue) && attrValue.length >= 2) {
                                        const stmt = attrValue[0];
                                        const values = attrValue[1];
                                        
                                        console.log(`${indent}    Stmt: ${stmt?.toString?.() || 'null'}`);
                                        console.log(`${indent}    Values (${values?.length || 0}):`);
                                        
                                        if (Array.isArray(values)) {
                                            for (const v of values) {
                                                const typeName = v?.constructor?.name || typeof v;
                                                console.log(`${indent}      - Type: ${typeName}`);
                                                console.log(`${indent}        Value: ${v?.toString?.() || v}`);
                                                
                                                // 如果是 MethodSignature，打印详细信息
                                                if (typeName === 'MethodSignature') {
                                                    console.log(`${indent}        MethodName: ${v.getMethodSubSignature?.()?.getMethodName?.()}`);
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        
                        // 递归子节点
                        if (node.children) {
                            for (const child of node.children) {
                                analyzeNode(child, depth + 1);
                            }
                        }
                    };
                    
                    analyzeNode(root);
                }
            }
        });

        it('1.3 回调提取器的解析结果', () => {
            console.log('\n========== 回调提取结果 ==========\n');
            
            const extractor = new ViewTreeCallbackExtractor(scene);
            
            for (const arkClass of scene.getClasses()) {
                if (arkClass.getName() === 'Index') {
                    const callbacks = extractor.extractFromComponent(arkClass);
                    
                    console.log(`提取到 ${callbacks.length} 个回调：`);
                    console.log('─'.repeat(50));
                    
                    for (let i = 0; i < callbacks.length; i++) {
                        const cb = callbacks[i];
                        console.log(`\n回调 ${i + 1}:`);
                        console.log(`  组件类型: ${cb.componentType}`);
                        console.log(`  事件类型: ${cb.eventType}`);
                        console.log(`  方法名: ${cb.callbackMethod?.getName() || 'null'}`);
                        
                        // 打印回调方法的 CFG
                        if (cb.callbackMethod) {
                            const cfg = cb.callbackMethod.getCfg();
                            if (cfg) {
                                console.log(`  CFG 内容:`);
                                let stmtCount = 0;
                                for (const block of cfg.getBlocks()) {
                                    for (const stmt of block.getStmts()) {
                                        stmtCount++;
                                        if (stmtCount <= 5) {
                                            console.log(`    ${stmt.toString()}`);
                                        }
                                    }
                                }
                                if (stmtCount > 5) {
                                    console.log(`    ... (共 ${stmtCount} 条语句)`);
                                }
                            }
                        }
                    }
                    console.log('\n' + '─'.repeat(50));
                }
            }
        });
    });
});
