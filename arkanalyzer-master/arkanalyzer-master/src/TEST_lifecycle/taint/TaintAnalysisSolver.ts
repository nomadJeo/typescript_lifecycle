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
 * @file taint/TaintAnalysisSolver.ts
 * @description 污点分析求解器
 * 
 * 继承 DataflowSolver，实现完整的跨过程污点分析。
 * 利用 ArkAnalyzer 已有的：
 * - CallGraph：调用图
 * - ClassHierarchyAnalysis：类层次分析
 * - Cfg：控制流图
 */

import { Scene } from '../../Scene';
import { DataflowSolver } from '../../core/dataflow/DataflowSolver';
import { Stmt } from '../../core/base/Stmt';
import { ArkMethod } from '../../core/model/ArkMethod';

import { TaintFact } from './TaintFact';
import { TaintAnalysisProblem, TaintAnalysisConfig, ResourceLeak, TaintLeak } from './TaintAnalysisProblem';
import { SourceSinkManager } from './SourceSinkManager';
import { LifecycleModelCreator } from '../LifecycleModelCreator';

// ============================================================================
// TaintAnalysisSolver
// ============================================================================

/**
 * 污点分析求解器
 * 
 * 继承 ArkAnalyzer 的 DataflowSolver，使用 IFDS 算法进行跨过程污点分析。
 */
export class TaintAnalysisSolver extends DataflowSolver<TaintFact> {
    private taintProblem: TaintAnalysisProblem;
    
    constructor(problem: TaintAnalysisProblem, scene: Scene) {
        super(problem, scene);
        this.taintProblem = problem;
    }
    
    /**
     * 获取污点分析问题
     */
    getTaintProblem(): TaintAnalysisProblem {
        return this.taintProblem;
    }
    
    /**
     * 获取发现的资源泄漏
     */
    getResourceLeaks(): ResourceLeak[] {
        return this.taintProblem.getResourceLeaks();
    }
    
    /**
     * 获取发现的污点泄漏
     */
    getTaintLeaks(): TaintLeak[] {
        return this.taintProblem.getTaintLeaks();
    }
    
    /**
     * 获取所有到达的污点事实
     */
    getReachedFacts(): Map<Stmt, Set<TaintFact>> {
        const result = new Map<Stmt, Set<TaintFact>>();
        
        for (const pathEdge of this.pathEdgeSet) {
            const stmt = pathEdge.edgeEnd.node;
            const fact = pathEdge.edgeEnd.fact;
            
            if (!result.has(stmt)) {
                result.set(stmt, new Set());
            }
            result.get(stmt)!.add(fact);
        }
        
        return result;
    }
    
    /**
     * 检查特定语句是否有特定的污点事实
     */
    hasFactAtStmt(stmt: Stmt, fact: TaintFact): boolean {
        return this.computeResult(stmt, fact);
    }
}

// ============================================================================
// TaintAnalysisRunner
// ============================================================================

/**
 * 污点分析运行器
 * 
 * 封装完整的污点分析流程：
 * - runFromDummyMain：以 LifecycleModelCreator 生成的 DummyMain 为入口（推荐，覆盖所有生命周期路径）
 * - runFromMethod：从指定方法开始
 * - runFromAllEntries：从所有生命周期方法逐个分析
 */
export class TaintAnalysisRunner {
    private scene: Scene;
    private sourceSinkManager: SourceSinkManager;
    private config: TaintAnalysisConfig;
    
    constructor(scene: Scene, config?: TaintAnalysisConfig) {
        this.scene = scene;
        this.sourceSinkManager = config?.sourceSinkManager ?? new SourceSinkManager();
        this.config = config ?? {};
    }
    
    /**
     * 以 DummyMain 为入口运行污点分析（推荐方式）
     * 
     * 流程：
     * 1. 用 LifecycleModelCreator 构建 DummyMain（串联所有生命周期回调）
     * 2. 以 DummyMain 为入口点创建 TaintAnalysisProblem
     * 3. 用 TaintAnalysisSolver（继承 DataflowSolver）执行 IFDS 求解
     * 4. 收集跨生命周期的资源泄漏结果
     */
    runFromDummyMain(): TaintAnalysisResult {
        const startTime = Date.now();
        
        // Step 1: 构建 DummyMain
        let dummyMain: ArkMethod;
        let creator: LifecycleModelCreator;
        try {
            // 将约束2（maxCallbackIterations）传入 LifecycleModelCreator 的 bounds 配置
            // LifecycleModelCreator 构造函数会深合并 bounds，缺省字段使用 DEFAULT_LIFECYCLE_CONFIG.bounds 填充
            const lifecycleConfig = this.config.maxCallbackIterations !== undefined
                ? { bounds: { maxCallbackIterations: this.config.maxCallbackIterations } as any }
                : undefined;
            creator = new LifecycleModelCreator(this.scene, lifecycleConfig);
            creator.create();
            dummyMain = creator.getDummyMain();
        } catch (e) {
            return this.failResult(`DummyMain 构建失败: ${e}`);
        }
        
        if (!dummyMain) {
            return this.failResult('DummyMain 为空');
        }
        
        const cfg = dummyMain.getCfg();
        if (!cfg) {
            return this.failResult('DummyMain 没有 CFG');
        }
        
        // Step 2: 获取入口语句
        const entryStmt = this.getEntryStmt(dummyMain);
        if (!entryStmt) {
            return this.failResult('无法获取 DummyMain 的入口语句');
        }
        
        // Step 3: 创建问题 + 求解（传入 abilityMethodMap 以启用约束1/约束3）
        const problem = new TaintAnalysisProblem(entryStmt, dummyMain, {
            ...this.config,
            sourceSinkManager: this.sourceSinkManager,
            abilityMethodMap: creator.getAbilityMethodSet(),
        });
        
        const solver = new TaintAnalysisSolver(problem, this.scene);
        solver.solve();
        
        const duration = Date.now() - startTime;
        
        // Step 4: 收集结果
        const reachedFacts = solver.getReachedFacts();
        const resourceLeaks = solver.getResourceLeaks();
        const taintLeaks = solver.getTaintLeaks();
        
        return {
            success: true,
            entryMethod: dummyMain.getSignature().toString(),
            resourceLeaks,
            taintLeaks,
            reachedFacts,
            statistics: {
                analyzedMethods: this.countAnalyzedMethods(reachedFacts),
                totalFacts: this.countTotalFacts(reachedFacts),
                sourceCount: problem.getSourceSinkManager().getSourceCount(),
                sinkCount: problem.getSourceSinkManager().getSinkCount(),
                duration,
            },
        };
    }
    
    /**
     * 从指定方法开始运行污点分析
     */
    runFromMethod(method: ArkMethod): TaintAnalysisResult {
        const cfg = method.getCfg();
        if (!cfg) {
            return this.failResult(`方法 ${method.getName()} 没有 CFG`);
        }
        
        const entryStmt = this.getEntryStmt(method);
        if (!entryStmt) {
            return this.failResult(`无法获取方法 ${method.getName()} 的入口语句`);
        }
        
        const startTime = Date.now();
        
        const problem = new TaintAnalysisProblem(entryStmt, method, {
            ...this.config,
            sourceSinkManager: this.sourceSinkManager,
        });
        
        const solver = new TaintAnalysisSolver(problem, this.scene);
        solver.solve();
        
        const duration = Date.now() - startTime;
        const reachedFacts = solver.getReachedFacts();
        
        return {
            success: true,
            entryMethod: method.getSignature().toString(),
            resourceLeaks: solver.getResourceLeaks(),
            taintLeaks: solver.getTaintLeaks(),
            reachedFacts,
            statistics: {
                analyzedMethods: this.countAnalyzedMethods(reachedFacts),
                totalFacts: this.countTotalFacts(reachedFacts),
                sourceCount: problem.getSourceSinkManager().getSourceCount(),
                sinkCount: problem.getSourceSinkManager().getSinkCount(),
                duration,
            },
        };
    }
    
    /**
     * 从所有入口方法运行污点分析
     */
    runFromAllEntries(): TaintAnalysisResult[] {
        const results: TaintAnalysisResult[] = [];
        const entryMethods = this.findEntryMethods();
        
        for (const method of entryMethods) {
            const result = this.runFromMethod(method);
            results.push(result);
        }
        
        return results;
    }
    
    private failResult(error: string): TaintAnalysisResult {
        return {
            success: false,
            error,
            resourceLeaks: [],
            taintLeaks: [],
            reachedFacts: new Map(),
            statistics: { analyzedMethods: 0, totalFacts: 0, sourceCount: 0, sinkCount: 0, duration: 0 },
        };
    }
    
    private getEntryStmt(method: ArkMethod): Stmt | null {
        const cfg = method.getCfg();
        if (!cfg) return null;
        
        // 优先使用 getStartingStmt（LifecycleModelCreator 会设置此值）
        try {
            const startingStmt = cfg.getStartingStmt();
            if (startingStmt) return startingStmt;
        } catch {
            // getStartingStmt 可能未设置，继续使用其他方式
        }
        
        // 回退：从 startBlock 获取
        try {
            const startBlock = cfg.getStartingBlock();
            if (startBlock) {
                const stmts = startBlock.getStmts();
                const paramCount = method.getParameters().length;
                if (stmts.length > paramCount) {
                    return stmts[paramCount];
                }
                if (stmts.length > 0) {
                    return stmts[0];
                }
            }
        } catch {
            // getStartingBlock 可能因为 stmtToBlock 未建立而失败
        }
        
        // 最终回退：遍历所有块找到第一条语句
        const blocks = cfg.getBlocks();
        for (const block of blocks) {
            const stmts = block.getStmts();
            if (stmts.length > 0) {
                return stmts[0];
            }
        }
        
        return null;
    }
    
    private findEntryMethods(): ArkMethod[] {
        const entryMethods: ArkMethod[] = [];
        
        for (const arkClass of this.scene.getClasses()) {
            for (const method of arkClass.getMethods()) {
                if (this.isLifecycleMethod(method) || method.getName() === 'main') {
                    entryMethods.push(method);
                }
            }
        }
        
        return entryMethods;
    }
    
    private isLifecycleMethod(method: ArkMethod): boolean {
        const lifecycleMethods = [
            'onCreate', 'onDestroy', 'onWindowStageCreate', 'onWindowStageDestroy',
            'onForeground', 'onBackground', 'onNewWant',
            'aboutToAppear', 'aboutToDisappear', 'onPageShow', 'onPageHide',
        ];
        return lifecycleMethods.includes(method.getName());
    }
    
    private countAnalyzedMethods(reachedFacts: Map<Stmt, Set<TaintFact>>): number {
        const methods = new Set<string>();
        for (const stmt of reachedFacts.keys()) {
            const cfg = stmt.getCfg();
            if (cfg) {
                methods.add(cfg.getDeclaringMethod().getSignature().toString());
            }
        }
        return methods.size;
    }
    
    private countTotalFacts(reachedFacts: Map<Stmt, Set<TaintFact>>): number {
        let count = 0;
        for (const facts of reachedFacts.values()) {
            count += facts.size;
        }
        return count;
    }
}

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 污点分析结果
 */
export interface TaintAnalysisResult {
    /** 是否成功 */
    success: boolean;
    /** 错误信息（如果失败） */
    error?: string;
    /** 入口方法签名 */
    entryMethod?: string;
    /** 发现的资源泄漏（Source 未到达 Sink） */
    resourceLeaks: ResourceLeak[];
    /** 发现的污点泄漏（Source 到达了 Sink） */
    taintLeaks: TaintLeak[];
    /** 到达的污点事实 */
    reachedFacts: Map<Stmt, Set<TaintFact>>;
    /** 统计信息 */
    statistics: {
        /** 分析的方法数 */
        analyzedMethods: number;
        /** 总的事实数 */
        totalFacts: number;
        /** Source 数 */
        sourceCount: number;
        /** Sink 数 */
        sinkCount: number;
        /** 耗时（毫秒） */
        duration: number;
    };
}

// ============================================================================
// 导出
// ============================================================================

export { TaintAnalysisSolver as default };
