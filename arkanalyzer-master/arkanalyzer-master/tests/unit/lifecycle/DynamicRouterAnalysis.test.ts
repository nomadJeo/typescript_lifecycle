/*
 * 动态路由参数追踪测试
 * 目标：分析 NavigationAnalyzer 对各种动态 URL 的处理能力
 */

import { describe, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';
import { NavigationAnalyzer } from '../../../src/TEST_lifecycle';

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

describe('动态路由参数追踪分析', () => {
    
    describe('1. 各场景 URL 提取测试', () => {
        let scene: Scene;
        let analyzer: NavigationAnalyzer;
        
        beforeAll(() => {
            scene = buildScene('router');
            analyzer = new NavigationAnalyzer(scene);
        });

        it('1.1 分析所有路由相关方法', () => {
            console.log('\n========== 动态路由分析 ==========\n');
            
            const results: { method: string; urls: string[] }[] = [];
            
            for (const arkClass of scene.getClasses()) {
                const className = arkClass.getName();
                
                // 只分析测试组件
                if (!className.includes('Index') && !className.includes('DynamicRouter')) {
                    continue;
                }
                
                console.log(`\n分析类: ${className}`);
                console.log('─'.repeat(50));
                
                for (const method of arkClass.getMethods()) {
                    const methodName = method.getName();
                    
                    // 跳过非业务方法
                    if (methodName.startsWith('%') || methodName === 'build' || 
                        methodName === 'constructor' || methodName === 'aboutToAppear') {
                        continue;
                    }
                    
                    // 分析方法中的路由调用
                    const targets = analyzer.analyzeMethod(method);
                    
                    if (targets.length > 0) {
                        console.log(`\n  方法: ${methodName}()`);
                        
                        for (const target of targets) {
                            console.log(`    类型: ${target.navigationType}`);
                            console.log(`    目标: ${target.targetAbilityName || '未解析'}`);

                            results.push({
                                method: methodName,
                                urls: [target.targetAbilityName || '未解析']
                            });
                        }
                    }
                }
            }
            
            console.log('\n\n========== 汇总 ==========\n');
            console.log('| 方法 | 解析结果 |');
            console.log('|------|----------|');
            for (const r of results) {
                console.log(`| ${r.method} | ${r.urls.join(', ')} |`);
            }
        });

        it('1.2 深入分析 IR 中的路由调用', () => {
            console.log('\n========== IR 级别分析 ==========\n');
            
            for (const arkClass of scene.getClasses()) {
                if (!arkClass.getName().includes('Index') && !arkClass.getName().includes('DynamicRouter')) {
                    continue;
                }
                
                for (const method of arkClass.getMethods()) {
                    const methodName = method.getName();
                    
                    // 只分析 goToPage 开头的方法
                    if (!methodName.startsWith('goTo')) {
                        continue;
                    }
                    
                    const cfg = method.getCfg();
                    if (!cfg) continue;
                    
                    console.log(`\n方法: ${methodName}()`);
                    console.log('IR 语句：');
                    
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            const stmtStr = stmt.toString();
                            console.log(`  ${stmtStr}`);
                            
                            // 标记路由相关调用
                            if (stmtStr.includes('pushUrl') || stmtStr.includes('replaceUrl')) {
                                console.log('    ↑ [路由调用]');
                            }
                            if (stmtStr.includes('.url') && stmtStr.includes('=')) {
                                console.log('    ↑ [URL 赋值]');
                            }
                        }
                    }
                }
            }
        });

        it('1.3 测试已有的 extractRouterUrl 方法', () => {
            console.log('\n========== extractRouterUrl 测试 ==========\n');
            
            // 测试 Index.ets 中的各种场景
            for (const arkClass of scene.getClasses()) {
                if (arkClass.getName() !== 'Index') continue;
                
                for (const method of arkClass.getMethods()) {
                    const methodName = method.getName();
                    if (!methodName.startsWith('goTo')) continue;
                    
                    const cfg = method.getCfg();
                    if (!cfg) continue;
                    
                    console.log(`\n测试方法: ${methodName}()`);
                    
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            // 检查是否是调用语句
                            const stmtStr = stmt.toString();
                            if (stmtStr.includes('pushUrl') || stmtStr.includes('replaceUrl')) {
                                // 尝试获取调用表达式
                                const invokeExpr = (stmt as any).getInvokeExpr?.() || 
                                                   (stmt as any).getRightOp?.();
                                
                                if (invokeExpr) {
                                    // 使用私有方法来测试 (需要通过 prototype 访问)
                                    const url = (analyzer as any).extractRouterUrl?.(invokeExpr);
                                    console.log(`  语句: ${stmtStr.substring(0, 60)}...`);
                                    console.log(`  提取的 URL: ${url || '未能提取'}`);
                                }
                            }
                        }
                    }
                }
            }
        });
    });
});
