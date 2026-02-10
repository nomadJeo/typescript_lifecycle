/*
 * 匿名类（对象字面量）分析测试
 * 目标：找出 URL 值在 ArkAnalyzer 生成的匿名类中如何存储
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

describe('匿名类结构分析', () => {
    let scene: Scene;
    
    beforeAll(() => {
        scene = buildScene('router');
    });

    it('1. 列出所有类（包括匿名类）', () => {
        console.log('\n========== 所有类列表 ==========\n');
        
        for (const arkClass of scene.getClasses()) {
            const className = arkClass.getName();
            console.log(`类: ${className}`);
        }
    });

    it('2. 分析匿名类的结构', () => {
        console.log('\n========== 匿名类详细分析 ==========\n');
        
        for (const arkClass of scene.getClasses()) {
            const className = arkClass.getName();
            
            // 只分析匿名类 (%AC 开头的类)
            if (!className.startsWith('%AC')) {
                continue;
            }
            
            console.log(`\n匿名类: ${className}`);
            console.log('─'.repeat(60));
            
            // 打印父类
            const superClass = arkClass.getSuperClassName();
            if (superClass) {
                console.log(`  父类: ${superClass}`);
            }
            
            // 打印字段
            console.log('  字段:');
            for (const field of arkClass.getFields()) {
                console.log(`    - ${field.getName()}: ${field.getType()}`);
            }
            
            // 打印方法
            console.log('  方法:');
            for (const method of arkClass.getMethods()) {
                const methodName = method.getName();
                console.log(`    - ${methodName}()`);
                
                // 打印方法的 CFG
                const cfg = method.getCfg();
                if (cfg) {
                    console.log('      IR:');
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            const stmtStr = stmt.toString();
                            console.log(`        ${stmtStr}`);
                            
                            // 标记含有 url 的语句
                            if (stmtStr.includes('url') || stmtStr.includes('pages/')) {
                                console.log('          ↑ [包含 URL 相关内容]');
                            }
                        }
                    }
                }
            }
            
            // 检查静态初始化
            const staticInit = arkClass.getStaticInitializer();
            if (staticInit) {
                console.log('  静态初始化:');
                const cfg = staticInit.getCfg();
                if (cfg) {
                    for (const block of cfg.getBlocks()) {
                        for (const stmt of block.getStmts()) {
                            console.log(`    ${stmt.toString()}`);
                        }
                    }
                }
            }
        }
    });

    it('3. 寻找 URL 值的位置', () => {
        console.log('\n========== URL 值搜索 ==========\n');
        
        // 搜索所有包含 'pages/' 的语句
        for (const arkClass of scene.getClasses()) {
            for (const method of arkClass.getMethods()) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        const stmtStr = stmt.toString();
                        if (stmtStr.includes('pages/') || stmtStr.includes("'Page")) {
                            console.log(`类: ${arkClass.getName()}`);
                            console.log(`方法: ${method.getName()}`);
                            console.log(`语句: ${stmtStr}`);
                            console.log('');
                        }
                    }
                }
            }
        }
    });

    it('4. 分析 goToPage3 场景（分步赋值）', () => {
        console.log('\n========== goToPage3 场景分析 ==========\n');
        
        for (const arkClass of scene.getClasses()) {
            if (arkClass.getName() !== 'DynamicRouter') continue;
            
            for (const method of arkClass.getMethods()) {
                if (method.getName() !== 'goToPage3') continue;
                
                console.log('goToPage3 方法的 IR:');
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const block of cfg.getBlocks()) {
                    for (const stmt of block.getStmts()) {
                        console.log(`  ${stmt.toString()}`);
                    }
                }
            }
        }
        
        // 查找相关的匿名类
        console.log('\n相关匿名类 (%AC3$DynamicRouter.goToPage3):');
        for (const arkClass of scene.getClasses()) {
            if (arkClass.getName().includes('AC3$DynamicRouter')) {
                console.log(`  类名: ${arkClass.getName()}`);
                
                for (const field of arkClass.getFields()) {
                    console.log(`  字段: ${field.getName()} = ${field.getType()}`);
                }
                
                for (const method of arkClass.getMethods()) {
                    console.log(`  方法: ${method.getName()}`);
                    const cfg = method.getCfg();
                    if (cfg) {
                        for (const block of cfg.getBlocks()) {
                            for (const stmt of block.getStmts()) {
                                console.log(`    ${stmt.toString()}`);
                            }
                        }
                    }
                }
            }
        }
    });
});
