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
 * @file cli/LifecycleAnalyzer.ts
 * @description 生命周期分析器 - 封装核心分析功能，提供简洁的 API
 */

import * as path from 'path';
import * as fs from 'fs';
import { Scene } from '../../Scene';
import { SceneConfig } from '../../Config';
import { LifecycleModelCreator } from '../LifecycleModelCreator';
import { AbilityCollector } from '../AbilityCollector';
import { ViewTreeCallbackExtractor } from '../ViewTreeCallbackExtractor';
import { NavigationAnalyzer } from '../NavigationAnalyzer';
import {
    AbilityInfo,
    ComponentInfo,
    BoundsConfig,
    DEFAULT_LIFECYCLE_CONFIG,
} from '../LifecycleTypes';
import { ResourceLeakDetector, ResourceLeakReport } from '../taint/ResourceLeakDetector';
import { TaintAnalysisRunner } from '../taint/TaintAnalysisSolver';
import { SourceSinkLocationScanner } from '../taint/SourceSinkLocationScanner';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 分析选项
 */
export interface AnalysisOptions {
    /** SDK 路径（可选，默认使用内置路径） */
    sdkPath?: string;
    /** 是否进行类型推断 */
    inferTypes?: boolean;
    /** 是否生成 DummyMain */
    generateDummyMain?: boolean;
    /** 是否分析导航 */
    analyzeNavigation?: boolean;
    /** 是否提取 UI 回调 */
    extractUICallbacks?: boolean;
    /** 是否检测资源泄漏（简化版方法内检测） */
    detectResourceLeaks?: boolean;
    /** 是否运行完整 IFDS 污点分析（以 DummyMain 为入口） */
    runTaintAnalysis?: boolean;
    /** 是否输出详细日志 */
    verbose?: boolean;
    /**
     * 有界约束配置（控制三条有界化约束的参数）
     * - maxCallbackIterations：约束2，DummyMain CFG 循环展开次数，默认 1（DAG，推荐）
     * - maxAbilitiesPerFlow：约束1，单条数据流最多访问的 Ability 数量，默认 3
     * - maxNavigationHops：约束3，单条数据流最多经过的导航跳数，默认 5
     */
    bounds?: Partial<BoundsConfig>;
}

/**
 * Ability 分析结果
 */
export interface AbilityAnalysisResult {
    name: string;
    className: string;
    isEntry: boolean;
    lifecycleMethods: string[];
    filePath: string;
}

/**
 * Component 分析结果
 */
export interface ComponentAnalysisResult {
    name: string;
    className: string;
    lifecycleMethods: string[];
    uiCallbacks: UICallbackSummary[];
    hasViewTree: boolean;
    filePath: string;
}

/**
 * UI 回调摘要
 */
export interface UICallbackSummary {
    eventType: string;
    methodName: string;
    controlType?: string;
}

/**
 * 导航分析结果
 */
export interface NavigationSummary {
    source: string;
    target: string;
    type: string;
    method: string;
}

/**
 * DummyMain 分析结果
 */
export interface DummyMainSummary {
    methodSignature: string;
    blockCount: number;
    stmtCount: number;
    lifecycleCallCount: number;
    uiCallbackCount: number;
}

/**
 * 资源泄漏摘要
 */
export interface ResourceLeakSummary {
    /** 泄漏总数 */
    totalLeaks: number;
    /** 按资源类型统计 */
    byResourceType: Record<string, number>;
    /** 按严重程度统计 */
    bySeverity: Record<string, number>;
    /** 分析的方法数 */
    analyzedMethods: number;
    /** 发现的 Source 数 */
    sourceCount: number;
    /** 发现的 Sink 数 */
    sinkCount: number;
}

/** 可序列化的资源泄漏（用于 JSON 传输） */
export interface ResourceLeakSerialized {
    resourceType: string;
    expectedSink: string;
    description: string;
    /** 泄漏类型：resource | closure | memory，用于严重程度标签 */
    category?: string;
    sourceLocation: { filePath: string; line: number; col: number };
}

/** 可序列化的污点泄漏（用于 JSON 传输） */
export interface TaintLeakSerialized {
    description: string;
    sourceLocation: { filePath: string; line: number; col: number };
    sinkLocation: { filePath: string; line: number; col: number };
}

/**
 * 完整 IFDS 污点分析摘要
 */
export interface TaintAnalysisSummary {
    /** 入口方法签名 */
    entryMethod: string;
    /** 资源泄漏（可序列化，用于 Web 展示） */
    resourceLeaks: ResourceLeakSerialized[];
    /** 污点泄漏（可序列化，用于 Web 展示） */
    taintLeaks: TaintLeakSerialized[];
    /** 统计信息 */
    statistics: {
        analyzedMethods: number;
        totalFacts: number;
        sourceCount: number;
        sinkCount: number;
        duration: number;
    };
}

/**
 * 完整分析结果
 */
export interface AnalysisResult {
    /** 项目信息 */
    project: {
        path: string;
        name: string;
        analyzedAt: string;
    };
    /** 统计摘要 */
    summary: {
        totalFiles: number;
        totalClasses: number;
        abilityCount: number;
        componentCount: number;
        lifecycleMethodCount: number;
        uiCallbackCount: number;
        navigationCount: number;
        resourceLeakCount: number;
        /** Source 数目（污点分析时可用） */
        sourceCount?: number;
        /** Sink 数目（污点分析时可用） */
        sinkCount?: number;
        /** 污点泄漏数目（污点分析时可用） */
        taintLeakCount?: number;
    };
    /** Ability 分析结果 */
    abilities: AbilityAnalysisResult[];
    /** Component 分析结果 */
    components: ComponentAnalysisResult[];
    /** 导航分析结果 */
    navigations: NavigationSummary[];
    /** DummyMain 信息 */
    dummyMain?: DummyMainSummary;
    /** UI 回调按类型统计 */
    uiCallbacksByType: Record<string, number>;
    /** 资源泄漏检测结果（简化版） */
    resourceLeaks?: {
        summary: ResourceLeakSummary;
        leaks: ResourceLeakReport[];
    };
    /** 完整 IFDS 污点分析结果 */
    taintAnalysis?: TaintAnalysisSummary;
    /** Source 位置列表（污点分析时可用，用于 Web 展示） */
    sourceLocations?: Array<{ resourceType: string; methodPattern: string; methodSig: string; filePath: string; line: number; col: number }>;
    /** Sink 位置列表（污点分析时可用，用于 Web 展示） */
    sinkLocations?: Array<{ resourceType: string; methodPattern: string; methodSig: string; filePath: string; line: number; col: number }>;
    /** 本次分析实际使用的有界约束（污点分析时） */
    boundsUsed?: BoundsConfig;
    /** 分析耗时（毫秒） */
    duration: {
        sceneBuilding: number;
        abilityCollection: number;
        componentCollection: number;
        uiCallbackExtraction: number;
        navigationAnalysis: number;
        dummyMainGeneration: number;
        resourceLeakDetection: number;
        taintAnalysis: number;
        total: number;
    };
    /** 警告和错误 */
    warnings: string[];
    errors: string[];
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_OPTIONS: AnalysisOptions = {
    inferTypes: true,
    generateDummyMain: true,
    analyzeNavigation: true,
    extractUICallbacks: true,
    detectResourceLeaks: true,
    runTaintAnalysis: true,
    verbose: false,
};

// ============================================================================
// LifecycleAnalyzer 类
// ============================================================================

/**
 * 生命周期分析器
 * 
 * 封装 TEST_lifecycle 模块的核心功能，提供简洁的分析 API。
 * 
 * @example
 * ```typescript
 * const analyzer = new LifecycleAnalyzer();
 * const result = await analyzer.analyze('/path/to/harmony/project');
 * console.log(result.summary);
 * ```
 */
export class LifecycleAnalyzer {
    private options: AnalysisOptions;
    private warnings: string[] = [];
    private errors: string[] = [];

    constructor(options: Partial<AnalysisOptions> = {}) {
        this.options = { ...DEFAULT_OPTIONS, ...options };
    }

    /**
     * 分析 HarmonyOS 项目
     * @param projectPath 项目路径
     * @returns 分析结果
     */
    async analyze(projectPath: string): Promise<AnalysisResult> {
        this.warnings = [];
        this.errors = [];
        
        const startTime = Date.now();
        const duration: AnalysisResult['duration'] = {
            sceneBuilding: 0,
            abilityCollection: 0,
            componentCollection: 0,
            uiCallbackExtraction: 0,
            navigationAnalysis: 0,
            dummyMainGeneration: 0,
            resourceLeakDetection: 0,
            taintAnalysis: 0,
            total: 0,
        };

        // 验证路径
        const resolvedPath = path.resolve(projectPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`项目路径不存在: ${resolvedPath}`);
        }

        this.log(`开始分析项目: ${resolvedPath}`);

        try {
            return await this.analyzeInternal(resolvedPath, startTime, duration);
        } catch (e) {
            // 阶段五：栈溢出防护 - 捕获 Maximum call stack size exceeded 等异常，返回优雅降级结果
            const errMsg = e instanceof Error ? e.message : String(e);
            this.errors.push(`分析异常 (栈溢出或其它): ${errMsg}`);
            duration.total = Date.now() - startTime;
            return this.buildErrorResult(resolvedPath, duration);
        }
    }

    /**
     * 内部分析逻辑（可被 try-catch 包裹）
     */
    private async analyzeInternal(
        resolvedPath: string,
        startTime: number,
        duration: AnalysisResult['duration']
    ): Promise<AnalysisResult> {
        let scene: Scene;
        let abilities: AbilityInfo[] = [];
        let components: ComponentInfo[] = [];
        let uiCallbacksByType: Record<string, number> = {};
        let navigations: NavigationSummary[] = [];
        let dummyMainSummary: DummyMainSummary | undefined;
        let resourceLeakResult: AnalysisResult['resourceLeaks'] | undefined;
        let taintAnalysisSummary: TaintAnalysisSummary | undefined;
        let sourceLocations: AnalysisResult['sourceLocations'];
        let sinkLocations: AnalysisResult['sinkLocations'];

        // 1. 构建 Scene
        let sceneStart = Date.now();
        scene = this.buildScene(resolvedPath);
        duration.sceneBuilding = Date.now() - sceneStart;
        this.log(`Scene 构建完成，耗时 ${duration.sceneBuilding}ms`);

        // 2. 收集 Ability
        let abilityStart = Date.now();
        const abilityCollector = new AbilityCollector(scene);
        abilities = abilityCollector.collectAllAbilities();
        duration.abilityCollection = Date.now() - abilityStart;
        this.log(`收集到 ${abilities.length} 个 Ability`);

        // 3. 收集 Component
        let componentStart = Date.now();
        components = abilityCollector.collectAllComponents();
        duration.componentCollection = Date.now() - componentStart;
        this.log(`收集到 ${components.length} 个 Component`);

        // 4. 提取 UI 回调
        let uiCallbackStart = Date.now();
        const callbackExtractor = new ViewTreeCallbackExtractor(scene);
        uiCallbacksByType = {};
        
        if (this.options.extractUICallbacks) {
            for (const component of components) {
                const callbacks = callbackExtractor.extractFromComponent(component.arkClass);
                component.uiCallbacks = callbacks;
                
                for (const callback of callbacks) {
                    const typeName = String(callback.eventType) || 'UNKNOWN';
                    uiCallbacksByType[typeName] = (uiCallbacksByType[typeName] || 0) + 1;
                }
            }
        }
        duration.uiCallbackExtraction = Date.now() - uiCallbackStart;

        // 5. 分析导航
        let navigationStart = Date.now();
        
        if (this.options.analyzeNavigation) {
            const navAnalyzer = new NavigationAnalyzer(scene);
            const navResults: Array<{sourceClass: string, targets: Array<{targetAbilityName?: string, targetPageUrl?: string, navigationType: string, sourceMethod: string}>}> = [];
            
            // 分析所有 Ability 和 Component
            for (const ability of abilities) {
                const result = navAnalyzer.analyzeClass(ability.arkClass);
                if (result.navigationTargets.length > 0 || result.initialPage) {
                    navResults.push({
                        sourceClass: ability.name,
                        targets: result.navigationTargets.map(t => ({
                            targetAbilityName: t.targetAbilityName,
                            targetPageUrl: result.initialPage || undefined,
                            navigationType: t.navigationType,
                            sourceMethod: t.sourceMethod?.getName() || 'unknown',
                        })),
                    });
                }
            }
            for (const component of components) {
                const result = navAnalyzer.analyzeClass(component.arkClass);
                if (result.navigationTargets.length > 0 || result.initialPage) {
                    navResults.push({
                        sourceClass: component.name,
                        targets: result.navigationTargets.map(t => ({
                            targetAbilityName: t.targetAbilityName,
                            targetPageUrl: result.initialPage || undefined,
                            navigationType: t.navigationType,
                            sourceMethod: t.sourceMethod?.getName() || 'unknown',
                        })),
                    });
                }
            }
            
            navigations = this.convertNavigations(navResults);
        }
        duration.navigationAnalysis = Date.now() - navigationStart;
        this.log(`分析到 ${navigations.length} 个导航关系`);

        // 6. 生成 DummyMain
        let dummyMainStart = Date.now();
        
        if (this.options.generateDummyMain) {
            try {
                const creator = new LifecycleModelCreator(scene);
                creator.create();
                const dummyMain = creator.getDummyMain();
                
                if (dummyMain) {
                    const cfg = dummyMain.getCfg();
                    let stmtCount = 0;
                    let lifecycleCallCount = 0;
                    let uiCallbackCount = 0;
                    
                    if (cfg) {
                        for (const block of cfg.getBlocks()) {
                            for (const stmt of block.getStmts()) {
                                stmtCount++;
                                const stmtStr = stmt.toString();
                                if (stmtStr.includes('onCreate') || 
                                    stmtStr.includes('onDestroy') ||
                                    stmtStr.includes('aboutToAppear') ||
                                    stmtStr.includes('build')) {
                                    lifecycleCallCount++;
                                }
                                if (stmtStr.includes('onClick') || 
                                    stmtStr.includes('onChange') ||
                                    stmtStr.includes('onTouch')) {
                                    uiCallbackCount++;
                                }
                            }
                        }
                        
                        const blocks = cfg.getBlocks();
                        dummyMainSummary = {
                            methodSignature: dummyMain.getSignature().toString(),
                            blockCount: blocks instanceof Set ? blocks.size : (blocks as any).length || 0,
                            stmtCount,
                            lifecycleCallCount,
                            uiCallbackCount,
                        };
                    }
                }
            } catch (e) {
                this.warnings.push(`DummyMain 生成警告: ${e}`);
            }
        }
        duration.dummyMainGeneration = Date.now() - dummyMainStart;

        // 7. 资源泄漏检测
        let resourceLeakStart = Date.now();
        
        if (this.options.detectResourceLeaks) {
            try {
                const detector = new ResourceLeakDetector(scene);
                const leaks = detector.detect();
                
                // 构建统计信息
                const byResourceType: Record<string, number> = {};
                const bySeverity: Record<string, number> = {};
                
                for (const leak of leaks) {
                    byResourceType[leak.resourceType] = (byResourceType[leak.resourceType] || 0) + 1;
                    bySeverity[leak.severity] = (bySeverity[leak.severity] || 0) + 1;
                }
                
                resourceLeakResult = {
                    summary: {
                        totalLeaks: leaks.length,
                        byResourceType,
                        bySeverity,
                        analyzedMethods: detector.getAnalyzedMethodCount(),
                        sourceCount: detector.getSourceCount(),
                        sinkCount: detector.getSinkCount(),
                    },
                    leaks,
                };
                
                this.log(`资源泄漏检测完成: 分析了 ${detector.getAnalyzedMethodCount()} 个方法，发现 ${leaks.length} 个泄漏`);
            } catch (e) {
                this.warnings.push(`资源泄漏检测警告: ${e}`);
            }
        }
        duration.resourceLeakDetection = Date.now() - resourceLeakStart;

        // 8. 完整 IFDS 污点分析（以 DummyMain 为入口）
        let taintAnalysisStart = Date.now();
        
        if (this.options.runTaintAnalysis) {
            try {
                const taintConfig = {
                    ...(this.options.bounds?.maxCallbackIterations !== undefined
                        ? { maxCallbackIterations: this.options.bounds.maxCallbackIterations }
                        : {}),
                    ...(this.options.bounds?.maxAbilitiesPerFlow !== undefined
                        ? { maxAbilitiesPerFlow: this.options.bounds.maxAbilitiesPerFlow }
                        : {}),
                    ...(this.options.bounds?.maxNavigationHops !== undefined
                        ? { maxNavigationHops: this.options.bounds.maxNavigationHops }
                        : {}),
                };
                const runner = new TaintAnalysisRunner(scene, Object.keys(taintConfig).length > 0 ? taintConfig : undefined);
                const taintResult = runner.runFromDummyMain();
                
                if (taintResult.success) {
                    const resourceLeaksSerialized: ResourceLeakSerialized[] = taintResult.resourceLeaks.map(rl => ({
                        resourceType: rl.resourceType,
                        expectedSink: rl.expectedSink,
                        description: rl.description,
                        category: rl.source?.category,
                        sourceLocation: SourceSinkLocationScanner.getLocationForStmt(scene, rl.sourceStmt),
                    }));
                    const taintLeaksSerialized: TaintLeakSerialized[] = taintResult.taintLeaks.map(tl => ({
                        description: tl.description,
                        sourceLocation: SourceSinkLocationScanner.getLocationForStmt(scene, tl.sourceStmt),
                        sinkLocation: SourceSinkLocationScanner.getLocationForStmt(scene, tl.sinkStmt),
                    }));
                    taintAnalysisSummary = {
                        entryMethod: taintResult.entryMethod || 'unknown',
                        resourceLeaks: resourceLeaksSerialized,
                        taintLeaks: taintLeaksSerialized,
                        statistics: taintResult.statistics,
                    };
                    
                    this.log(
                        `IFDS 污点分析完成: 分析了 ${taintResult.statistics.analyzedMethods} 个方法, ` +
                        `发现 ${taintResult.resourceLeaks.length} 个资源泄漏, ` +
                        `${taintResult.taintLeaks.length} 个污点泄漏`
                    );
                } else {
                    this.warnings.push(`IFDS 污点分析未成功: ${taintResult.error}`);
                }
            } catch (e) {
                this.warnings.push(`IFDS 污点分析警告: ${e}`);
            }
        }
        duration.taintAnalysis = Date.now() - taintAnalysisStart;

        // 9. Source/Sink 位置扫描（污点分析时）
        if (this.options.runTaintAnalysis) {
            const scanner = new SourceSinkLocationScanner(scene);
            const { sources, sinks } = scanner.scan();
            sourceLocations = sources.map(s => ({
                resourceType: s.resourceType,
                methodPattern: s.methodPattern,
                methodSig: s.methodSig,
                filePath: s.filePath,
                line: s.line,
                col: s.col,
            }));
            sinkLocations = sinks.map(s => ({
                resourceType: s.resourceType,
                methodPattern: s.methodPattern,
                methodSig: s.methodSig,
                filePath: s.filePath,
                line: s.line,
                col: s.col,
            }));
        }

        duration.total = Date.now() - startTime;

        // 计算实际使用的有界约束（用户选项合并默认值）
        const defaultBounds = DEFAULT_LIFECYCLE_CONFIG.bounds;
        const boundsUsed: BoundsConfig | undefined = this.options.runTaintAnalysis ? {
            maxCallbackIterations: this.options.bounds?.maxCallbackIterations ?? defaultBounds.maxCallbackIterations,
            maxAbilitiesPerFlow: this.options.bounds?.maxAbilitiesPerFlow ?? defaultBounds.maxAbilitiesPerFlow,
            maxNavigationHops: this.options.bounds?.maxNavigationHops ?? defaultBounds.maxNavigationHops,
        } : undefined;

        // 构建结果
        const result: AnalysisResult = {
            project: {
                path: resolvedPath,
                name: path.basename(resolvedPath),
                analyzedAt: new Date().toISOString(),
            },
            summary: {
                totalFiles: scene.getFiles().length,
                totalClasses: scene.getClasses().length,
                abilityCount: abilities.length,
                componentCount: components.length,
                lifecycleMethodCount: this.countLifecycleMethods(abilities, components),
                uiCallbackCount: Object.values(uiCallbacksByType).reduce((a, b) => a + b, 0),
                navigationCount: navigations.length,
                resourceLeakCount: taintAnalysisSummary
                    ? taintAnalysisSummary.resourceLeaks.length
                    : (resourceLeakResult?.summary.totalLeaks ?? 0),
                ...(sourceLocations && {
                    sourceCount: sourceLocations.length,
                    sinkCount: (sinkLocations ?? []).length,
                    taintLeakCount: taintAnalysisSummary?.taintLeaks.length ?? 0,
                }),
            },
            abilities: this.convertAbilities(abilities),
            components: this.convertComponents(components),
            navigations,
            dummyMain: dummyMainSummary,
            uiCallbacksByType,
            resourceLeaks: resourceLeakResult,
            taintAnalysis: taintAnalysisSummary,
            sourceLocations,
            sinkLocations,
            boundsUsed,
            duration,
            warnings: this.warnings,
            errors: this.errors,
        };

        this.log(`分析完成，总耗时 ${duration.total}ms`);
        return result;
    }

    /**
     * 构建错误降级结果（阶段五：栈溢出防护）
     * 当分析过程中抛出 Maximum call stack size exceeded 等异常时返回
     */
    private buildErrorResult(resolvedPath: string, duration: AnalysisResult['duration']): AnalysisResult {
        return {
            project: {
                path: resolvedPath,
                name: path.basename(resolvedPath),
                analyzedAt: new Date().toISOString(),
            },
            summary: {
                totalFiles: 0,
                totalClasses: 0,
                abilityCount: 0,
                componentCount: 0,
                lifecycleMethodCount: 0,
                uiCallbackCount: 0,
                navigationCount: 0,
                resourceLeakCount: 0,
            },
            abilities: [],
            components: [],
            navigations: [],
            uiCallbacksByType: {},
            duration,
            warnings: this.warnings,
            errors: this.errors,
        };
    }

    /**
     * 构建 Scene
     */
    private buildScene(projectPath: string): Scene {
        const config = new SceneConfig();
        
        // 配置 SDK（如果提供）
        if (this.options.sdkPath && fs.existsSync(this.options.sdkPath)) {
            config.getSdksObj().push({
                moduleName: '',
                name: 'etsSdk',
                path: this.options.sdkPath,
            });
        }
        
        config.buildFromProjectDir(projectPath);
        
        const scene = new Scene();
        scene.buildSceneFromProjectDir(config);
        
        if (this.options.inferTypes) {
            scene.inferTypes();
        }
        
        return scene;
    }

    /**
     * 转换 Ability 信息
     */
    private convertAbilities(abilities: AbilityInfo[]): AbilityAnalysisResult[] {
        return abilities.map(ability => ({
            name: ability.name,
            className: ability.arkClass.getName(),
            isEntry: ability.isEntry,
            lifecycleMethods: Array.from(ability.lifecycleMethods.keys())
                .map(stage => String(stage)),
            filePath: ability.arkClass.getDeclaringArkFile()?.getName() || 'unknown',
        }));
    }

    /**
     * 转换 Component 信息
     */
    private convertComponents(components: ComponentInfo[]): ComponentAnalysisResult[] {
        return components.map(component => ({
            name: component.name,
            className: component.arkClass.getName(),
            lifecycleMethods: Array.from(component.lifecycleMethods.keys())
                .map(stage => String(stage)),
            uiCallbacks: component.uiCallbacks.map(cb => ({
                eventType: String(cb.eventType),
                methodName: cb.callbackMethod?.getName() || 'anonymous',
                controlType: undefined,
            })),
            hasViewTree: true,
            filePath: component.arkClass.getDeclaringArkFile()?.getName() || 'unknown',
        }));
    }

    /**
     * 转换导航信息
     */
    private convertNavigations(navResults: Array<{sourceClass: string, targets: Array<{targetAbilityName?: string, targetPageUrl?: string, navigationType: string, sourceMethod: string}>}>): NavigationSummary[] {
        const summaries: NavigationSummary[] = [];
        
        for (const result of navResults) {
            for (const target of result.targets) {
                summaries.push({
                    source: result.sourceClass,
                    target: target.targetAbilityName || target.targetPageUrl || 'unknown',
                    type: target.navigationType,
                    method: target.sourceMethod,
                });
            }
        }
        
        return summaries;
    }

    /**
     * 统计生命周期方法数量
     */
    private countLifecycleMethods(abilities: AbilityInfo[], components: ComponentInfo[]): number {
        let count = 0;
        for (const ability of abilities) {
            count += ability.lifecycleMethods.size;
        }
        for (const component of components) {
            count += component.lifecycleMethods.size;
        }
        return count;
    }

    /**
     * 日志输出
     */
    private log(message: string): void {
        if (this.options.verbose) {
            console.log(`[LifecycleAnalyzer] ${message}`);
        }
    }
}
