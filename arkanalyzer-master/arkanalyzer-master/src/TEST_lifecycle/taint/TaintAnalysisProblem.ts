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
 * @file taint/TaintAnalysisProblem.ts
 * @description 污点分析问题定义
 * 
 * 实现基于 IFDS 框架的污点分析，继承 DataflowProblem<TaintFact>
 */

import { DataflowProblem, FlowFunction } from '../../core/dataflow/DataflowProblem';
import { Stmt, ArkAssignStmt, ArkInvokeStmt, ArkReturnStmt } from '../../core/base/Stmt';
import { ArkMethod } from '../../core/model/ArkMethod';
import { Local } from '../../core/base/Local';
import { Value } from '../../core/base/Value';
import { ArkInstanceFieldRef, ArkStaticFieldRef } from '../../core/base/Ref';
import { ArkInstanceInvokeExpr, ArkStaticInvokeExpr, AbstractInvokeExpr } from '../../core/base/Expr';
import { ClassType } from '../../core/base/Type';

import { TaintFact, AccessPath, SourceDefinition, ILocal, IFieldSignature, IStmt } from './TaintFact';
import { SourceSinkManager, MethodCallInfo } from './SourceSinkManager';

// ============================================================================
// 污点分析结果
// ============================================================================

/**
 * 污点泄漏报告
 */
export interface TaintLeak {
    /** 泄漏的 Source */
    source: SourceDefinition;
    /** Source 语句 */
    sourceStmt: Stmt;
    /** Sink 语句 */
    sinkStmt: Stmt;
    /** 污点传播路径（从 Source 到 Sink 的语句序列） */
    propagationPath: Stmt[];
    /** 泄漏类型描述 */
    description: string;
}

/**
 * 资源泄漏报告（未释放的资源）
 */
export interface ResourceLeak {
    /** Source 定义 */
    source: SourceDefinition;
    /** Source 语句 */
    sourceStmt: Stmt;
    /** 资源类型 */
    resourceType: string;
    /** 未到达的 Sink */
    expectedSink: string;
    /** 泄漏描述 */
    description: string;
}

// ============================================================================
// FlowFunction 实现
// ============================================================================

/**
 * 基础 FlowFunction：不传播任何污点
 */
class KillAllFlowFunction implements FlowFunction<TaintFact> {
    getDataFacts(_d: TaintFact): Set<TaintFact> {
        return new Set();
    }
}

/**
 * 恒等 FlowFunction：保持污点不变
 */
class IdentityFlowFunction implements FlowFunction<TaintFact> {
    getDataFacts(d: TaintFact): Set<TaintFact> {
        return new Set([d]);
    }
}

/**
 * 生成 FlowFunction：生成新的污点
 */
class GenFlowFunction implements FlowFunction<TaintFact> {
    private genFacts: Set<TaintFact>;
    
    constructor(genFacts: Set<TaintFact>) {
        this.genFacts = genFacts;
    }
    
    getDataFacts(d: TaintFact): Set<TaintFact> {
        const result = new Set<TaintFact>([d]);
        for (const fact of this.genFacts) {
            result.add(fact);
        }
        return result;
    }
}

// ============================================================================
// TaintAnalysisProblem
// ============================================================================

/**
 * 污点分析问题配置
 */
export interface TaintAnalysisConfig {
    /** 最大传播深度（有界分析） */
    maxPropagationDepth?: number;
    /** 是否追踪隐式流 */
    trackImplicitFlows?: boolean;
    /** 是否追踪字段敏感 */
    fieldSensitive?: boolean;
    /** 自定义 SourceSinkManager */
    sourceSinkManager?: SourceSinkManager;
}

/**
 * 污点分析问题
 * 
 * 基于 IFDS 框架实现的污点分析，用于检测资源泄漏
 */
export class TaintAnalysisProblem extends DataflowProblem<TaintFact> {
    /** 入口语句 */
    private entryPoint: Stmt;
    
    /** 入口方法 */
    private entryMethod: ArkMethod;
    
    /** Source/Sink 管理器 */
    private sourceSinkManager: SourceSinkManager;
    
    /** 分析配置 */
    private config: Required<TaintAnalysisConfig>;
    
    /** 零值（IFDS 需要的特殊值） */
    private zeroFact: TaintFact;
    
    /** 发现的污点泄漏 */
    private taintLeaks: TaintLeak[] = [];
    
    /** 活跃的污点（用于资源泄漏检测） */
    private activeTaints: Map<string, TaintFact> = new Map();
    
    constructor(
        entryPoint: Stmt,
        entryMethod: ArkMethod,
        config?: TaintAnalysisConfig
    ) {
        super();
        
        this.entryPoint = entryPoint;
        this.entryMethod = entryMethod;
        this.sourceSinkManager = config?.sourceSinkManager ?? new SourceSinkManager();
        
        this.config = {
            maxPropagationDepth: config?.maxPropagationDepth ?? 100,
            trackImplicitFlows: config?.trackImplicitFlows ?? false,
            fieldSensitive: config?.fieldSensitive ?? true,
            sourceSinkManager: this.sourceSinkManager,
        };
        
        this.zeroFact = TaintFact.getZeroFact();
    }
    
    // ========================================================================
    // DataflowProblem 接口实现
    // ========================================================================
    
    /**
     * 创建零值
     */
    createZeroValue(): TaintFact {
        return this.zeroFact;
    }
    
    /**
     * 获取入口点
     */
    getEntryPoint(): Stmt {
        return this.entryPoint;
    }
    
    /**
     * 获取入口方法
     */
    getEntryMethod(): ArkMethod {
        return this.entryMethod;
    }
    
    /**
     * 判断两个 TaintFact 是否相等
     */
    factEqual(d1: TaintFact, d2: TaintFact): boolean {
        return d1.equals(d2);
    }
    
    /**
     * 普通边的流函数
     * 处理普通语句（非调用语句）的污点传播
     */
    getNormalFlowFunction(srcStmt: Stmt, _tgtStmt: Stmt): FlowFunction<TaintFact> {
        const problem = this;
        
        return new (class implements FlowFunction<TaintFact> {
            getDataFacts(dataFact: TaintFact): Set<TaintFact> {
                const result = new Set<TaintFact>();
                
                // 零值特殊处理：检查是否是 Source 点
                if (dataFact.isZeroFact()) {
                    result.add(dataFact);
                    
                    // 在赋值语句中检查 Source
                    if (srcStmt instanceof ArkAssignStmt) {
                        const newTaints = problem.handleAssignmentSource(srcStmt);
                        for (const taint of newTaints) {
                            result.add(taint);
                        }
                    }
                    
                    return result;
                }
                
                // 非零值：处理污点传播
                if (srcStmt instanceof ArkAssignStmt) {
                    return problem.handleAssignmentPropagation(srcStmt, dataFact);
                }
                
                // 其他语句：保持污点不变
                result.add(dataFact);
                return result;
            }
        })();
    }
    
    /**
     * 调用边的流函数
     * 处理函数调用时污点从调用者到被调用者的传播
     */
    getCallFlowFunction(srcStmt: Stmt, method: ArkMethod): FlowFunction<TaintFact> {
        const problem = this;
        
        return new (class implements FlowFunction<TaintFact> {
            getDataFacts(dataFact: TaintFact): Set<TaintFact> {
                const result = new Set<TaintFact>();
                
                if (!(srcStmt instanceof ArkInvokeStmt)) {
                    return result;
                }
                
                const invokeExpr = srcStmt.getInvokeExpr();
                const args = invokeExpr.getArgs();
                const params = method.getParameters();
                
                // 零值传播
                if (dataFact.isZeroFact()) {
                    result.add(dataFact);
                    return result;
                }
                
                // 处理实例方法调用：this 指针的污点传播
                if (invokeExpr instanceof ArkInstanceInvokeExpr) {
                    const base = invokeExpr.getBase();
                    if (problem.matchesAccessPathBase(dataFact.accessPath, base)) {
                        // 将 base 的污点映射到 this
                        const thisLocal = problem.getThisLocal(method);
                        if (thisLocal) {
                            const newAp = dataFact.accessPath.replaceBase(thisLocal as ILocal);
                            result.add(dataFact.deriveWithNewAccessPath(newAp));
                        }
                    }
                }
                
                // 处理参数传播
                for (let i = 0; i < args.length && i < params.length; i++) {
                    const arg = args[i];
                    if (problem.matchesAccessPathBase(dataFact.accessPath, arg)) {
                        // 获取形参的 Local
                        const paramLocal = problem.getParameterLocal(method, i);
                        if (paramLocal) {
                            const newAp = dataFact.accessPath.replaceBase(paramLocal as ILocal);
                            result.add(dataFact.deriveWithNewAccessPath(newAp));
                        }
                    }
                }
                
                return result;
            }
        })();
    }
    
    /**
     * 返回边的流函数
     * 处理函数返回时污点从被调用者到调用者的传播
     */
    getExitToReturnFlowFunction(srcStmt: Stmt, tgtStmt: Stmt, callStmt: Stmt): FlowFunction<TaintFact> {
        const problem = this;
        
        return new (class implements FlowFunction<TaintFact> {
            getDataFacts(dataFact: TaintFact): Set<TaintFact> {
                const result = new Set<TaintFact>();
                
                // 零值传播
                if (dataFact.isZeroFact()) {
                    result.add(dataFact);
                    return result;
                }
                
                // 处理返回值的污点传播
                if (srcStmt instanceof ArkReturnStmt && callStmt instanceof ArkAssignStmt) {
                    const returnValue = srcStmt.getOp();
                    if (problem.matchesAccessPathBase(dataFact.accessPath, returnValue)) {
                        const leftOp = callStmt.getLeftOp();
                        if (leftOp instanceof Local) {
                            const newAp = dataFact.accessPath.replaceBase(leftOp as ILocal);
                            result.add(dataFact.deriveWithNewAccessPath(newAp));
                        }
                    }
                }
                
                return result;
            }
        })();
    }
    
    /**
     * 调用到返回边的流函数
     * 处理调用语句前后的污点传播（不经过被调用函数的部分）
     */
    getCallToReturnFlowFunction(srcStmt: Stmt, _tgtStmt: Stmt): FlowFunction<TaintFact> {
        const problem = this;
        
        return new (class implements FlowFunction<TaintFact> {
            getDataFacts(dataFact: TaintFact): Set<TaintFact> {
                const result = new Set<TaintFact>();
                
                // 零值特殊处理
                if (dataFact.isZeroFact()) {
                    result.add(dataFact);
                    
                    // 检查调用语句是否是 Source
                    if (srcStmt instanceof ArkAssignStmt) {
                        const rightOp = srcStmt.getRightOp();
                        if (problem.isInvokeExpr(rightOp)) {
                            const newTaints = problem.handleInvokeSource(srcStmt);
                            for (const taint of newTaints) {
                                result.add(taint);
                            }
                        }
                    } else if (srcStmt instanceof ArkInvokeStmt) {
                        // 检查调用本身是否是 Source（无返回值的情况）
                        // 如 sensor.on() 等
                    }
                    
                    return result;
                }
                
                // 检查是否是 Sink
                if (srcStmt instanceof ArkInvokeStmt) {
                    problem.checkSink(srcStmt, dataFact);
                }
                
                // 默认保持污点（不被调用 kill 的部分）
                result.add(dataFact);
                
                // 检查是否被赋值语句 kill
                if (srcStmt instanceof ArkAssignStmt) {
                    const leftOp = srcStmt.getLeftOp();
                    if (problem.matchesAccessPathBase(dataFact.accessPath, leftOp)) {
                        // 被重新赋值，kill 原有污点
                        result.delete(dataFact);
                    }
                }
                
                return result;
            }
        })();
    }
    
    // ========================================================================
    // 辅助方法
    // ========================================================================
    
    /**
     * 处理赋值语句中的 Source 检测
     */
    private handleAssignmentSource(stmt: ArkAssignStmt): Set<TaintFact> {
        const result = new Set<TaintFact>();
        const rightOp = stmt.getRightOp();
        
        // 检查右值是否是方法调用
        if (this.isInvokeExpr(rightOp)) {
            const invokeExpr = rightOp as AbstractInvokeExpr;
            const callInfo = this.extractCallInfo(invokeExpr);
            
            const sourceDef = this.sourceSinkManager.isSource(callInfo);
            if (sourceDef && sourceDef.returnTainted) {
                const leftOp = stmt.getLeftOp();
                if (leftOp instanceof Local) {
                    const ap = new AccessPath(leftOp as ILocal, null, [], sourceDef.taintSubFields ?? false);
                    const taint = TaintFact.createFromSource(ap, sourceDef, stmt as IStmt);
                    result.add(taint);
                    
                    // 记录活跃污点
                    this.activeTaints.set(taint.hashCode().toString(), taint);
                }
            }
        }
        
        return result;
    }
    
    /**
     * 处理调用语句中的 Source 检测
     */
    private handleInvokeSource(stmt: ArkAssignStmt): Set<TaintFact> {
        return this.handleAssignmentSource(stmt);
    }
    
    /**
     * 处理赋值语句中的污点传播
     */
    private handleAssignmentPropagation(stmt: ArkAssignStmt, dataFact: TaintFact): Set<TaintFact> {
        const result = new Set<TaintFact>();
        const leftOp = stmt.getLeftOp();
        const rightOp = stmt.getRightOp();
        
        // 检查是否超过传播深度限制
        if (dataFact.propagationDepth >= this.config.maxPropagationDepth) {
            return result;
        }
        
        // Case 1: x = tainted
        // 直接赋值传播
        if (this.matchesAccessPathBase(dataFact.accessPath, rightOp)) {
            if (leftOp instanceof Local) {
                const newAp = dataFact.accessPath.replaceBase(leftOp as ILocal);
                result.add(dataFact.deriveWithNewStmt(newAp, stmt as IStmt));
            } else if (leftOp instanceof ArkInstanceFieldRef) {
                // x.f = tainted
                const fieldRef = leftOp as ArkInstanceFieldRef;
                const newAp = new AccessPath(
                    fieldRef.getBase() as ILocal,
                    null,
                    [fieldRef.getFieldSignature() as IFieldSignature],
                    dataFact.accessPath.taintSubFields
                );
                result.add(dataFact.deriveWithNewStmt(newAp, stmt as IStmt));
            }
        }
        
        // Case 2: x = tainted.f
        // 字段读取传播
        if (rightOp instanceof ArkInstanceFieldRef) {
            const fieldRef = rightOp as ArkInstanceFieldRef;
            const base = fieldRef.getBase();
            
            if (this.matchesAccessPathBase(dataFact.accessPath, base)) {
                // 检查字段是否匹配
                if (this.config.fieldSensitive) {
                    const fieldSig = fieldRef.getFieldSignature();
                    if (dataFact.accessPath.taintSubFields || 
                        this.matchesField(dataFact.accessPath, fieldSig as IFieldSignature)) {
                        if (leftOp instanceof Local) {
                            const newAp = dataFact.accessPath.appendField(fieldSig as IFieldSignature)
                                .replaceBase(leftOp as ILocal);
                            result.add(dataFact.deriveWithNewStmt(newAp, stmt as IStmt));
                        }
                    }
                } else {
                    // 非字段敏感：直接传播
                    if (leftOp instanceof Local) {
                        const newAp = new AccessPath(leftOp as ILocal, null, [], true);
                        result.add(dataFact.deriveWithNewStmt(newAp, stmt as IStmt));
                    }
                }
            }
        }
        
        // Case 3: x.f = tainted
        // 字段写入传播
        if (leftOp instanceof ArkInstanceFieldRef) {
            const fieldRef = leftOp as ArkInstanceFieldRef;
            const base = fieldRef.getBase();
            
            if (this.matchesAccessPathBase(dataFact.accessPath, rightOp)) {
                // 将污点传播到字段
                const newAp = new AccessPath(
                    base as ILocal,
                    null,
                    [fieldRef.getFieldSignature() as IFieldSignature],
                    dataFact.accessPath.taintSubFields
                );
                result.add(dataFact.deriveWithNewStmt(newAp, stmt as IStmt));
            }
        }
        
        // 保持原有污点（如果没有被 kill）
        if (!this.isKilled(dataFact, leftOp)) {
            result.add(dataFact);
        }
        
        return result;
    }
    
    /**
     * 检查是否是 Sink 点
     */
    private checkSink(stmt: ArkInvokeStmt, dataFact: TaintFact): void {
        const invokeExpr = stmt.getInvokeExpr();
        const callInfo = this.extractCallInfo(invokeExpr);
        
        const sinkDef = this.sourceSinkManager.isSink(callInfo);
        if (!sinkDef) {
            return;
        }
        
        // 检查 this 是否被污染
        if (sinkDef.requireTaintedThis && invokeExpr instanceof ArkInstanceInvokeExpr) {
            const base = invokeExpr.getBase();
            if (this.matchesAccessPathBase(dataFact.accessPath, base)) {
                // 找到了 Sink！记录污点泄漏（实际上是资源释放）
                this.recordTaintReachedSink(dataFact, stmt, sinkDef);
                return;
            }
        }
        
        // 检查参数是否被污染
        const args = invokeExpr.getArgs();
        for (const paramIndex of sinkDef.requiredTaintedParamIndices) {
            if (paramIndex < args.length) {
                const arg = args[paramIndex];
                if (this.matchesAccessPathBase(dataFact.accessPath, arg)) {
                    this.recordTaintReachedSink(dataFact, stmt, sinkDef);
                    return;
                }
            }
        }
    }
    
    /**
     * 记录污点到达 Sink
     */
    private recordTaintReachedSink(
        taint: TaintFact,
        sinkStmt: Stmt,
        _sinkDef: unknown
    ): void {
        // 对于资源泄漏检测，到达 Sink 意味着资源被正确释放
        // 从活跃污点中移除
        this.activeTaints.delete(taint.hashCode().toString());
    }
    
    /**
     * 提取方法调用信息
     */
    private extractCallInfo(invokeExpr: AbstractInvokeExpr): MethodCallInfo {
        const methodSig = invokeExpr.getMethodSignature();
        const className = methodSig.getDeclaringClassSignature().getClassName();
        const methodName = methodSig.getMethodSubSignature().getMethodName();
        
        return {
            className,
            methodName,
            fullSignature: methodSig.toString(),
        };
    }
    
    /**
     * 检查 AccessPath 的基础是否匹配给定的值
     */
    private matchesAccessPathBase(ap: AccessPath, value: Value): boolean {
        if (ap.isEmpty() || ap.isZero()) {
            return false;
        }
        
        const base = ap.base;
        if (!base) {
            return false;
        }
        
        if (value instanceof Local) {
            return base.getName() === value.getName();
        }
        
        return false;
    }
    
    /**
     * 检查 AccessPath 是否匹配指定字段
     */
    private matchesField(ap: AccessPath, field: IFieldSignature): boolean {
        const fields = ap.fields;
        if (fields.length === 0) {
            return ap.taintSubFields;
        }
        
        const firstField = fields[0];
        return firstField.getFieldName() === field.getFieldName();
    }
    
    /**
     * 检查污点是否被 kill
     */
    private isKilled(dataFact: TaintFact, leftOp: Value): boolean {
        return this.matchesAccessPathBase(dataFact.accessPath, leftOp);
    }
    
    /**
     * 判断值是否是调用表达式
     */
    private isInvokeExpr(value: Value): boolean {
        return value instanceof ArkInstanceInvokeExpr || 
               value instanceof ArkStaticInvokeExpr;
    }
    
    /**
     * 获取方法的 this 局部变量
     */
    private getThisLocal(method: ArkMethod): Local | null {
        const cfg = method.getCfg();
        if (!cfg) return null;
        
        const declaringClass = method.getDeclaringArkClass();
        return new Local('this', new ClassType(declaringClass.getSignature()));
    }
    
    /**
     * 获取方法的参数局部变量
     */
    private getParameterLocal(method: ArkMethod, index: number): Local | null {
        const cfg = method.getCfg();
        if (!cfg) return null;
        
        const startBlock = cfg.getStartingBlock();
        if (!startBlock) return null;
        
        const stmts = startBlock.getStmts();
        if (index < stmts.length) {
            const def = stmts[index].getDef();
            if (def instanceof Local) {
                return def;
            }
        }
        
        return null;
    }
    
    // ========================================================================
    // 结果获取
    // ========================================================================
    
    /**
     * 获取发现的污点泄漏
     */
    getTaintLeaks(): TaintLeak[] {
        return this.taintLeaks;
    }
    
    /**
     * 获取资源泄漏（分析结束后调用）
     * 返回仍然活跃（未释放）的资源
     */
    getResourceLeaks(): ResourceLeak[] {
        const leaks: ResourceLeak[] = [];
        
        for (const taint of this.activeTaints.values()) {
            const sourceContext = taint.sourceContext;
            if (!sourceContext) continue;
            
            const sourceDef = sourceContext.definition;
            const pairedSink = this.sourceSinkManager.getPairedSink(sourceDef);
            
            leaks.push({
                source: sourceDef,
                sourceStmt: sourceContext.stmt as Stmt,
                resourceType: sourceDef.resourceType || 'unknown',
                expectedSink: pairedSink?.id || 'unknown',
                description: `资源 ${sourceDef.resourceType} 在申请后未被释放。应调用 ${pairedSink?.methodPattern || '对应释放方法'} 进行释放。`,
            });
        }
        
        return leaks;
    }
    
    /**
     * 获取 SourceSinkManager
     */
    getSourceSinkManager(): SourceSinkManager {
        return this.sourceSinkManager;
    }
    
    /**
     * 获取配置
     */
    getConfig(): Required<TaintAnalysisConfig> {
        return this.config;
    }
}

// ============================================================================
// 导出
// ============================================================================

export { KillAllFlowFunction, IdentityFlowFunction, GenFlowFunction };
