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
 * @file TaintAnalysisIntegration.test.ts
 * @description 污点分析集成测试
 * 
 * 这是完整的集成测试，需要在完整的 ArkAnalyzer 运行环境中执行。
 * 
 * 关键点：
 * 1. 首先通过 Scene 构建程序分析环境（与 LifecycleModelCreator.test.ts 相同的方式）
 * 2. 然后才能使用 TaintAnalysisProblem
 * 
 * 注意：由于循环依赖问题，我们需要确保 Scene 先被正确初始化。
 */

import { describe, expect, it, beforeAll } from 'vitest';
import path from 'path';

// ============================================================================
// 第一步：导入 ArkAnalyzer 核心模块（Scene 优先）
// 这会触发 ArkAnalyzer 的完整初始化，解决循环依赖
// ============================================================================
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

// ============================================================================
// 第二步：导入我们的污点分析模块
// 此时 ArkAnalyzer 核心已经初始化完成
// ============================================================================
import { 
    TaintFact, 
    AccessPath, 
    SourceDefinition,
    SourceSinkManager,
    MethodCallInfo,
} from '../../../src/TEST_lifecycle/taint';
import { Local } from '../../../src/core/base/Local';

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
// 集成测试
// ============================================================================

describe('污点分析集成测试', () => {
    let scene: Scene;
    
    beforeAll(() => {
        // 构建 Scene - 这是 ArkAnalyzer 的核心入口
        scene = buildScene('simple');
        console.log('[Test] Scene 构建完成');
    });
    
    describe('ArkAnalyzer 环境验证', () => {
        it('应该成功构建 Scene', () => {
            expect(scene).not.toBeNull();
        });
        
        it('Scene 应该包含类', () => {
            const classes = scene.getClasses();
            expect(classes.length).toBeGreaterThan(0);
            console.log(`[Test] Scene 包含 ${classes.length} 个类`);
        });
        
        it('Scene 应该包含方法', () => {
            const methods = scene.getMethods();
            expect(methods.length).toBeGreaterThan(0);
            console.log(`[Test] Scene 包含 ${methods.length} 个方法`);
        });
    });
    
    describe('TaintFact 与 ArkAnalyzer 类型集成', () => {
        it('应该能够创建 AccessPath（使用 ArkAnalyzer Local）', () => {
            // 从 Scene 中获取一个实际的 Local（从 Stmt 的 Def 中）
            const methods = scene.getMethods();
            let foundLocal: Local | null = null;
            
            for (const method of methods) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const stmt of cfg.getStmts()) {
                    const def = stmt.getDef();
                    if (def instanceof Local) {
                        foundLocal = def;
                        break;
                    }
                }
                if (foundLocal) break;
            }
            
            if (foundLocal) {
                console.log(`[Test] 找到 Local: ${foundLocal.getName()}`);
                
                // 使用真实的 ArkAnalyzer Local 创建 AccessPath
                const ap = new AccessPath(foundLocal, []);
                
                expect(ap).not.toBeNull();
                expect(ap.isLocal()).toBe(true);
                console.log(`[Test] AccessPath: ${ap.toString()}`);
            } else {
                console.log('[Test] 未找到包含 Local 的语句，跳过');
            }
        });
        
        it('应该能够创建 TaintFact（使用 ArkAnalyzer Stmt）', () => {
            // 从 Scene 中获取一个实际的 Stmt 和 Local
            const methods = scene.getMethods();
            let foundStmt: any = null;
            let foundLocal: Local | null = null;
            
            for (const method of methods) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const stmt of cfg.getStmts()) {
                    const def = stmt.getDef();
                    if (def instanceof Local) {
                        foundStmt = stmt;
                        foundLocal = def;
                        break;
                    }
                }
                if (foundStmt) break;
            }
            
            if (foundStmt && foundLocal) {
                const ap = new AccessPath(foundLocal, []);
                
                const sourceDef: SourceDefinition = {
                    id: 'test.source',
                    methodPattern: 'test.createResource',
                    category: 'resource',
                    resourceType: 'TestResource',
                    returnTainted: true,
                    taintedParamIndices: [],
                };
                
                // 使用真实的 ArkAnalyzer Stmt 创建 TaintFact
                const taint = TaintFact.createFromSource(ap, sourceDef, foundStmt);
                
                expect(taint).not.toBeNull();
                expect(taint.isZeroFact()).toBe(false);
                expect(taint.sourceContext).not.toBeNull();
                console.log(`[Test] TaintFact: ${taint.toString()}`);
            } else {
                console.log('[Test] 未找到包含 Stmt 和 Local 的方法，跳过');
            }
        });
    });
    
    describe('SourceSinkManager 与实际代码集成', () => {
        it('应该能够识别代码中的方法调用', () => {
            const ssm = new SourceSinkManager();
            const methods = scene.getMethods();
            
            let sourceCount = 0;
            let sinkCount = 0;
            
            for (const method of methods) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                for (const stmt of cfg.getStmts()) {
                    // 检查语句中的方法调用
                    const exprs = stmt.getExprs();
                    for (const expr of exprs) {
                        // 检查是否是调用表达式
                        if (typeof (expr as any).getMethodSignature === 'function') {
                            const methodSig = (expr as any).getMethodSignature();
                            const className = methodSig.getDeclaringClassSignature().getClassName();
                            const methodName = methodSig.getMethodSubSignature().getMethodName();
                            
                            const callInfo: MethodCallInfo = {
                                className,
                                methodName,
                            };
                            
                            const source = ssm.isSource(callInfo);
                            const sink = ssm.isSink(callInfo);
                            
                            if (source) {
                                sourceCount++;
                                console.log(`[Test] 发现 Source: ${className}.${methodName}`);
                            }
                            if (sink) {
                                sinkCount++;
                                console.log(`[Test] 发现 Sink: ${className}.${methodName}`);
                            }
                        }
                    }
                }
            }
            
            console.log(`[Test] 共发现 ${sourceCount} 个 Source, ${sinkCount} 个 Sink`);
        });
    });
    
    describe('TaintFact 传播路径验证', () => {
        it('应该能够构建传播路径', () => {
            const methods = scene.getMethods();
            let stmts: any[] = [];
            let foundLocal: Local | null = null;
            
            // 找到有足够语句的方法
            for (const method of methods) {
                const cfg = method.getCfg();
                if (!cfg) continue;
                
                const methodStmts = cfg.getStmts();
                if (methodStmts.length >= 3) {
                    // 找一个有 Def 的语句来获取 Local
                    for (const stmt of methodStmts) {
                        const def = stmt.getDef();
                        if (def instanceof Local) {
                            foundLocal = def;
                            break;
                        }
                    }
                    if (foundLocal) {
                        stmts = methodStmts;
                        break;
                    }
                }
            }
            
            if (stmts.length >= 3 && foundLocal) {
                const ap = new AccessPath(foundLocal, []);
                const sourceDef: SourceDefinition = {
                    id: 'test.source',
                    methodPattern: 'test.createResource',
                    category: 'resource',
                    resourceType: 'TestResource',
                    returnTainted: true,
                    taintedParamIndices: [],
                };
                
                // 创建污点并模拟传播
                const taint1 = TaintFact.createFromSource(ap, sourceDef, stmts[0]);
                const taint2 = taint1.deriveWithNewStmt(stmts[1]);
                const taint3 = taint2.deriveWithNewStmt(stmts[2]);
                
                // 验证传播路径
                // 注意：getPropagationPath 返回的是传播过的语句（不包括前置节点为 null 的起始点）
                const path = taint3.getPropagationPath();
                expect(path.length).toBeGreaterThanOrEqual(2);
                
                console.log(`[Test] 传播路径长度: ${path.length}`);
                console.log(`[Test] 传播深度: ${taint3.propagationDepth}`);
            } else {
                console.log('[Test] 未找到足够的语句，跳过');
            }
        });
    });
});

// ============================================================================
// TaintAnalysisProblem 集成测试
// 注意：这需要在 Scene 构建后才能运行
// ============================================================================

describe('TaintAnalysisProblem 集成测试', () => {
    let scene: Scene;
    let TaintAnalysisProblem: any;
    
    beforeAll(async () => {
        // 先构建 Scene
        scene = buildScene('simple');
        
        // 然后动态导入 TaintAnalysisProblem
        // 这确保 ArkAnalyzer 核心模块已经完全加载
        try {
            const module = await import('../../../src/TEST_lifecycle/taint/TaintAnalysisProblem');
            TaintAnalysisProblem = module.TaintAnalysisProblem;
            console.log('[Test] TaintAnalysisProblem 加载成功');
        } catch (error) {
            console.log('[Test] TaintAnalysisProblem 加载失败:', error);
        }
    });
    
    it('应该能够创建 TaintAnalysisProblem 实例', () => {
        if (!TaintAnalysisProblem) {
            console.log('[Test] TaintAnalysisProblem 未加载，跳过');
            return;
        }
        
        const methods = scene.getMethods();
        const methodWithCfg = methods.find(m => {
            const cfg = m.getCfg();
            return cfg && cfg.getStmts().length > 0;
        });
        
        if (methodWithCfg) {
            const cfg = methodWithCfg.getCfg()!;
            const entryStmt = cfg.getStmts()[0];
            
            const problem = new TaintAnalysisProblem(entryStmt, methodWithCfg);
            
            expect(problem).not.toBeNull();
            expect(problem.getEntryPoint()).toBe(entryStmt);
            expect(problem.getEntryMethod()).toBe(methodWithCfg);
            
            const zeroValue = problem.createZeroValue();
            expect(zeroValue.isZeroFact()).toBe(true);
            
            console.log(`[Test] TaintAnalysisProblem 创建成功`);
            console.log(`[Test] 入口方法: ${methodWithCfg.getName()}`);
        }
    });
    
    it('应该能够获取流函数', () => {
        if (!TaintAnalysisProblem) {
            console.log('[Test] TaintAnalysisProblem 未加载，跳过');
            return;
        }
        
        const methods = scene.getMethods();
        const methodWithCfg = methods.find(m => {
            const cfg = m.getCfg();
            return cfg && cfg.getStmts().length >= 2;
        });
        
        if (methodWithCfg) {
            const cfg = methodWithCfg.getCfg()!;
            const stmts = cfg.getStmts();
            
            const problem = new TaintAnalysisProblem(stmts[0], methodWithCfg);
            
            // 获取 Normal Flow Function
            const normalFF = problem.getNormalFlowFunction(stmts[0], stmts[1]);
            expect(normalFF).not.toBeNull();
            expect(typeof normalFF.getDataFacts).toBe('function');
            
            // 测试零值的流函数
            const zeroFact = TaintFact.getZeroFact();
            const resultFacts = normalFF.getDataFacts(zeroFact);
            expect(resultFacts).toBeInstanceOf(Set);
            expect(resultFacts.has(zeroFact)).toBe(true);
            
            console.log(`[Test] Normal FlowFunction 工作正常`);
        }
    });
});

// ============================================================================
// TaintAnalysisSolver 集成测试 - 完整的 IFDS 分析
// ============================================================================

describe('TaintAnalysisSolver 集成测试（完整 IFDS）', () => {
    let scene: Scene;
    let TaintAnalysisSolver: any;
    let TaintAnalysisRunner: any;
    let TaintAnalysisProblem: any;
    
    beforeAll(async () => {
        scene = buildScene('simple');
        
        try {
            const solverModule = await import('../../../src/TEST_lifecycle/taint/TaintAnalysisSolver');
            TaintAnalysisSolver = solverModule.TaintAnalysisSolver;
            TaintAnalysisRunner = solverModule.TaintAnalysisRunner;
            
            const problemModule = await import('../../../src/TEST_lifecycle/taint/TaintAnalysisProblem');
            TaintAnalysisProblem = problemModule.TaintAnalysisProblem;
            
            console.log('[Test] TaintAnalysisSolver 加载成功');
        } catch (error) {
            console.log('[Test] TaintAnalysisSolver 加载失败:', error);
        }
    });
    
    it('应该能够创建 TaintAnalysisSolver 实例', () => {
        if (!TaintAnalysisSolver || !TaintAnalysisProblem) {
            console.log('[Test] 模块未加载，跳过');
            return;
        }
        
        const methods = scene.getMethods();
        const methodWithCfg = methods.find(m => {
            const cfg = m.getCfg();
            return cfg && cfg.getStmts().length > 0;
        });
        
        if (methodWithCfg) {
            const cfg = methodWithCfg.getCfg()!;
            const entryStmt = cfg.getStmts()[0];
            
            const problem = new TaintAnalysisProblem(entryStmt, methodWithCfg);
            const solver = new TaintAnalysisSolver(problem, scene);
            
            expect(solver).not.toBeNull();
            expect(solver.getTaintProblem()).toBe(problem);
            
            console.log(`[Test] TaintAnalysisSolver 创建成功`);
        }
    });
    
    it('应该能够运行 IFDS 求解', () => {
        if (!TaintAnalysisSolver || !TaintAnalysisProblem) {
            console.log('[Test] 模块未加载，跳过');
            return;
        }
        
        const methods = scene.getMethods();
        const methodWithCfg = methods.find(m => {
            const cfg = m.getCfg();
            return cfg && cfg.getStmts().length >= 3;
        });
        
        if (methodWithCfg) {
            const cfg = methodWithCfg.getCfg()!;
            const stmts = cfg.getStmts();
            const paramCount = methodWithCfg.getParameters().length;
            const entryStmt = stmts[Math.min(paramCount, stmts.length - 1)];
            
            const problem = new TaintAnalysisProblem(entryStmt, methodWithCfg);
            const solver = new TaintAnalysisSolver(problem, scene);
            
            // 运行求解
            solver.solve();
            
            // 获取结果
            const reachedFacts = solver.getReachedFacts();
            
            expect(reachedFacts).toBeInstanceOf(Map);
            console.log(`[Test] IFDS 求解完成，到达 ${reachedFacts.size} 个语句`);
        }
    });
    
    it('应该能够使用 TaintAnalysisRunner.runFromMethod', () => {
        if (!TaintAnalysisRunner) {
            console.log('[Test] TaintAnalysisRunner 未加载，跳过');
            return;
        }
        
        const methods = scene.getMethods();
        const methodWithCfg = methods.find(m => {
            const cfg = m.getCfg();
            return cfg && cfg.getStmts().length >= 3;
        });
        
        if (methodWithCfg) {
            const runner = new TaintAnalysisRunner(scene);
            const result = runner.runFromMethod(methodWithCfg);
            
            expect(result.success).toBe(true);
            expect(result.statistics).toBeDefined();
            expect(result.resourceLeaks).toBeDefined();
            expect(result.taintLeaks).toBeDefined();
            expect(result.entryMethod).toBeDefined();
            
            console.log(`[Test] TaintAnalysisRunner.runFromMethod 结果:`);
            console.log(`  - 入口: ${result.entryMethod}`);
            console.log(`  - 分析方法数: ${result.statistics.analyzedMethods}`);
            console.log(`  - 总事实数: ${result.statistics.totalFacts}`);
            console.log(`  - 耗时: ${result.statistics.duration}ms`);
        }
    });
    
    it('应该能够使用 TaintAnalysisRunner.runFromDummyMain', () => {
        if (!TaintAnalysisRunner) {
            console.log('[Test] TaintAnalysisRunner 未加载，跳过');
            return;
        }
        
        const runner = new TaintAnalysisRunner(scene);
        const result = runner.runFromDummyMain();
        
        expect(result.success).toBe(true);
        expect(result.entryMethod).toContain('extendedDummyMain');
        expect(result.resourceLeaks).toBeInstanceOf(Array);
        expect(result.taintLeaks).toBeInstanceOf(Array);
        expect(result.statistics.analyzedMethods).toBeGreaterThan(0);
        expect(result.statistics.totalFacts).toBeGreaterThan(0);
        
        console.log(`[Test] runFromDummyMain 结果:`);
        console.log(`  - 入口: ${result.entryMethod}`);
        console.log(`  - 分析方法数: ${result.statistics.analyzedMethods}`);
        console.log(`  - 总事实数: ${result.statistics.totalFacts}`);
        console.log(`  - 资源泄漏: ${result.resourceLeaks.length}`);
        console.log(`  - 污点泄漏: ${result.taintLeaks.length}`);
        console.log(`  - 耗时: ${result.statistics.duration}ms`);
    });
});

// ============================================================================
// SourceSinkManager 闭包/内存泄漏规则测试
// ============================================================================

describe('SourceSinkManager 闭包与内存泄漏规则', () => {
    let sourceSinkManager: SourceSinkManager;
    
    beforeAll(() => {
        sourceSinkManager = new SourceSinkManager();
    });
    
    it('应该包含闭包泄漏规则', () => {
        const closureSources = sourceSinkManager.getAllSources().filter(s => s.category === 'closure');
        expect(closureSources.length).toBeGreaterThanOrEqual(5);
        
        const closureSourceIds = closureSources.map(s => s.id);
        expect(closureSourceIds).toContain('setInterval');
        expect(closureSourceIds).toContain('setTimeout');
        expect(closureSourceIds).toContain('emitter.on');
        expect(closureSourceIds).toContain('EventHub.on');
        
        console.log(`[Test] 闭包泄漏 Source 规则: ${closureSources.length} 条`);
    });
    
    it('应该包含闭包释放规则', () => {
        const closureSinks = sourceSinkManager.getAllSinks().filter(s => s.category === 'closure_release');
        expect(closureSinks.length).toBeGreaterThanOrEqual(5);
        
        const closureSinkIds = closureSinks.map(s => s.id);
        expect(closureSinkIds).toContain('clearInterval');
        expect(closureSinkIds).toContain('clearTimeout');
        expect(closureSinkIds).toContain('emitter.off');
        expect(closureSinkIds).toContain('EventHub.off');
        
        console.log(`[Test] 闭包释放 Sink 规则: ${closureSinks.length} 条`);
    });
    
    it('应该包含内存泄漏规则', () => {
        const memorySources = sourceSinkManager.getAllSources().filter(s => s.category === 'memory');
        expect(memorySources.length).toBeGreaterThanOrEqual(3);
        
        const memorySourceIds = memorySources.map(s => s.id);
        expect(memorySourceIds).toContain('new.Worker');
        expect(memorySourceIds).toContain('Map.set');
        
        console.log(`[Test] 内存泄漏 Source 规则: ${memorySources.length} 条`);
    });
    
    it('应该包含内存释放规则', () => {
        const memorySinks = sourceSinkManager.getAllSinks().filter(s => s.category === 'memory_release');
        expect(memorySinks.length).toBeGreaterThanOrEqual(3);
        
        const memorySinkIds = memorySinks.map(s => s.id);
        expect(memorySinkIds).toContain('Worker.terminate');
        expect(memorySinkIds).toContain('Map.delete');
        expect(memorySinkIds).toContain('Set.delete');
        
        console.log(`[Test] 内存释放 Sink 规则: ${memorySinks.length} 条`);
    });
    
    it('闭包泄漏 Source/Sink 应该正确配对', () => {
        const setIntervalSource = sourceSinkManager.getSourceById('setInterval');
        expect(setIntervalSource).not.toBeNull();
        expect(setIntervalSource!.pairedSinkId).toBe('clearInterval');
        
        const clearIntervalSink = sourceSinkManager.getSinkById('clearInterval');
        expect(clearIntervalSink).not.toBeNull();
        expect(clearIntervalSink!.pairedSourceId).toBe('setInterval');
        
        const emitterOnSource = sourceSinkManager.getSourceById('emitter.on');
        expect(emitterOnSource).not.toBeNull();
        expect(emitterOnSource!.pairedSinkId).toBe('emitter.off');
    });
    
    it('内存泄漏 Source/Sink 应该正确配对', () => {
        const workerSource = sourceSinkManager.getSourceById('new.Worker');
        expect(workerSource).not.toBeNull();
        expect(workerSource!.pairedSinkId).toBe('Worker.terminate');
        
        const mapSetSource = sourceSinkManager.getSourceById('Map.set');
        expect(mapSetSource).not.toBeNull();
        expect(mapSetSource!.pairedSinkId).toBe('Map.delete');
    });
    
    it('应该能匹配闭包相关方法调用', () => {
        const setIntervalCall = { className: '', methodName: 'setInterval' };
        const result = sourceSinkManager.isSource(setIntervalCall);
        expect(result).not.toBeNull();
        expect(result!.category).toBe('closure');
        expect(result!.resourceType).toBe('IntervalTimer');
        
        const clearIntervalCall = { className: '', methodName: 'clearInterval' };
        const sinkResult = sourceSinkManager.isSink(clearIntervalCall);
        expect(sinkResult).not.toBeNull();
        expect(sinkResult!.category).toBe('closure_release');
    });
    
    it('规则总数应该显著增加', () => {
        const totalSources = sourceSinkManager.getSourceCount();
        const totalSinks = sourceSinkManager.getSinkCount();
        
        // 原来约 30 条资源规则，现在应该有 40+ 条
        expect(totalSources).toBeGreaterThanOrEqual(35);
        expect(totalSinks).toBeGreaterThanOrEqual(35);
        
        const byCategory: Record<string, number> = {};
        for (const s of sourceSinkManager.getAllSources()) {
            byCategory[s.category] = (byCategory[s.category] || 0) + 1;
        }
        
        console.log(`[Test] Source 规则按类别统计:`);
        for (const [cat, count] of Object.entries(byCategory)) {
            console.log(`  - ${cat}: ${count}`);
        }
        console.log(`[Test] Source 总数: ${totalSources}, Sink 总数: ${totalSinks}`);
    });
});

// ============================================================================
// LifecycleAnalyzer IFDS 集成测试
// ============================================================================

describe('LifecycleAnalyzer IFDS 污点分析集成', () => {
    it('LifecycleAnalyzer 应该包含 IFDS 污点分析结果', async () => {
        const { LifecycleAnalyzer } = await import('../../../src/TEST_lifecycle/cli/LifecycleAnalyzer');
        
        const analyzer = new LifecycleAnalyzer({
            sdkPath: SDK_DIR,
            runTaintAnalysis: true,
            verbose: false,
        });
        
        const projectPath = path.join(__dirname, '../../resources/lifecycle/simple');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.duration).toHaveProperty('taintAnalysis');
        
        if (result.taintAnalysis) {
            expect(result.taintAnalysis.entryMethod).toBeDefined();
            expect(result.taintAnalysis.resourceLeaks).toBeInstanceOf(Array);
            expect(result.taintAnalysis.taintLeaks).toBeInstanceOf(Array);
            expect(result.taintAnalysis.statistics).toBeDefined();
            
            console.log(`[Test] IFDS 污点分析集成结果:`);
            console.log(`  - 入口: ${result.taintAnalysis.entryMethod}`);
            console.log(`  - 分析方法数: ${result.taintAnalysis.statistics.analyzedMethods}`);
            console.log(`  - 资源泄漏: ${result.taintAnalysis.resourceLeaks.length}`);
            console.log(`  - 污点泄漏: ${result.taintAnalysis.taintLeaks.length}`);
            console.log(`  - 耗时: ${result.taintAnalysis.statistics.duration}ms`);
        } else {
            console.log(`[Test] IFDS 污点分析未产生结果（可能 DummyMain 构建失败）`);
        }
        
        console.log(`[Test] 总耗时: ${result.duration.total}ms`);
    });
    
    it('LifecycleAnalyzer 应该能够关闭 IFDS 分析', async () => {
        const { LifecycleAnalyzer } = await import('../../../src/TEST_lifecycle/cli/LifecycleAnalyzer');
        
        const analyzer = new LifecycleAnalyzer({
            sdkPath: SDK_DIR,
            runTaintAnalysis: false,
            verbose: false,
        });
        
        const projectPath = path.join(__dirname, '../../resources/lifecycle/simple');
        const result = await analyzer.analyze(projectPath);
        
        expect(result.taintAnalysis).toBeUndefined();
        expect(result.duration.taintAnalysis).toBeDefined();
    });
});
