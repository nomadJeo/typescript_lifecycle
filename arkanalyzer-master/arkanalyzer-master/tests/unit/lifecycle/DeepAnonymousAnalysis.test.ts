/*
 * 深入分析匿名类中的 URL 值存储位置
 */

import { describe, it, beforeAll } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

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

describe('匿名类深度分析', () => {
    let scene: Scene;
    
    beforeAll(() => {
        scene = buildScene('router');
    });

    it('1. 分析 %AC1$DynamicRouter.goToPage1 类', () => {
        console.log('\n========== %AC1$DynamicRouter.goToPage1 详细分析 ==========\n');
        
        for (const arkClass of scene.getClasses()) {
            if (!arkClass.getName().includes('AC1$DynamicRouter.goToPage1')) continue;
            
            console.log(`类名: ${arkClass.getName()}`);
            console.log(`签名: ${arkClass.getSignature()?.toString()}`);
            
            // 检查字段
            console.log('\n字段:');
            const fields = arkClass.getFields();
            if (fields.length === 0) {
                console.log('  (无字段)');
            }
            for (const field of fields) {
                console.log(`  ${field.getName()}: ${field.getType()}`);
                
                // 尝试获取初始值
                const initializer = field.getInitializer?.();
                if (initializer) {
                    console.log(`    初始值: ${initializer}`);
                }
            }
            
            // 检查所有方法
            console.log('\n方法:');
            for (const method of arkClass.getMethods()) {
                console.log(`\n  方法: ${method.getName()}`);
                console.log(`  签名: ${method.getSignature()?.toString()}`);
                
                const cfg = method.getCfg();
                if (cfg) {
                    console.log('  IR 语句:');
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            console.log(`    ${stmt.toString()}`);
                        }
                    }
                } else {
                    console.log('  (无 CFG)');
                }
            }
            
            // 检查父类
            console.log(`\n父类: ${arkClass.getSuperClassName()}`);
            
            // 检查实现的接口
            const interfaces = arkClass.getImplementedInterfaceNames?.();
            if (interfaces && interfaces.length > 0) {
                console.log(`接口: ${interfaces.join(', ')}`);
            }
        }
    });

    it('2. 检查匿名类是否有 url 字段或初始化', () => {
        console.log('\n========== 搜索 url 相关内容 ==========\n');
        
        const targetClasses = [
            '%AC1$DynamicRouter.goToPage1',
            '%AC0$Index.goToDetail1'
        ];
        
        for (const arkClass of scene.getClasses()) {
            const className = arkClass.getName();
            
            // 检查目标类
            if (!targetClasses.some(t => className.includes(t))) continue;
            
            console.log(`\n分析类: ${className}`);
            
            // 打印所有字段名
            console.log('字段:');
            for (const field of arkClass.getFields()) {
                const name = field.getName();
                const type = field.getType();
                console.log(`  ${name}: ${type}`);
            }
            
            // 检查是否有 %statInit 方法
            const statInit = arkClass.getMethodWithName?.('%statInit');
            if (statInit) {
                console.log('\n%statInit 方法:');
                const cfg = statInit.getCfg();
                if (cfg) {
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            console.log(`  ${stmt.toString()}`);
                        }
                    }
                }
            }
            
            // 检查构造函数
            const constructor = arkClass.getMethodWithName?.('constructor');
            if (constructor) {
                console.log('\nconstructor 方法:');
                const cfg = constructor.getCfg();
                if (cfg) {
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            console.log(`  ${stmt.toString()}`);
                        }
                    }
                }
            }
        }
    });

    it('3. 遍历所有语句寻找 Page1 字符串', () => {
        console.log('\n========== 搜索 "Page1" 字符串 ==========\n');
        
        let found = false;
        
        for (const arkClass of scene.getClasses()) {
            for (const method of arkClass.getMethods()) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        const stmtStr = stmt.toString();
                        if (stmtStr.includes('Page1') || stmtStr.includes('pages/Page1')) {
                            found = true;
                            console.log(`类: ${arkClass.getName()}`);
                            console.log(`方法: ${method.getName()}`);
                            console.log(`语句: ${stmtStr}`);
                            console.log('');
                        }
                    }
                }
            }
            
            // 也检查字段
            for (const field of arkClass.getFields()) {
                const fieldStr = field.toString?.();
                if (fieldStr?.includes('Page1')) {
                    found = true;
                    console.log(`类: ${arkClass.getName()}`);
                    console.log(`字段: ${field.getName()} -> ${fieldStr}`);
                }
            }
        }
        
        if (!found) {
            console.log('未找到 "Page1" 字符串！');
            console.log('可能原因：');
            console.log('  1. URL 值在匿名类的某个未被检索的位置');
            console.log('  2. ArkAnalyzer 在某些情况下丢失了常量字符串');
        }
    });

    it('4. 对比 goToPage1 (对象字面量) vs goToPage3 (分步赋值)', () => {
        console.log('\n========== 场景对比 ==========\n');
        
        for (const arkClass of scene.getClasses()) {
            if (arkClass.getName() !== 'DynamicRouter') continue;
            
            const methods = ['goToPage1', 'goToPage3'];
            
            for (const methodName of methods) {
                const method = arkClass.getMethodWithName?.(methodName);
                if (!method) continue;
                
                console.log(`\n方法: ${methodName}()`);
                console.log('─'.repeat(40));
                
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        console.log(`  ${stmt.toString()}`);
                    }
                }
            }
        }
        
        console.log('\n结论:');
        console.log('  goToPage1: URL 在匿名类内部，当前方法无法访问');
        console.log('  goToPage3: URL 通过 options.url = "xxx" 赋值，可以解析');
    });
});
