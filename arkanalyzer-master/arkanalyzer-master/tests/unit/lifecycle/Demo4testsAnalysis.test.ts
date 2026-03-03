/*
 * Demo4tests 实际项目测试
 * 
 * 四个真实鸿蒙项目从易到难：
 * 1. RingtoneKit_Codelab_Demo（初级：1 Ability, 1 Component）
 * 2. UIDesignKit_HdsNavigation_Codelab（初级：2 Ability, 3 Component, 多页面导航）
 * 3. CloudFoundationKit_Codelab_Prefetch_ArkTS（中级：1 Ability, 3 Component）
 * 4. OxHornCampus（高级：2 Ability, 17+ Component, 35 .ets 文件）
 */

import { describe, expect, it } from 'vitest';
import path from 'path';
import { Scene, SceneConfig } from '../../../src/index';
import { Sdk } from '../../../src/Config';

const SDK_DIR = path.join(__dirname, '../../resources/Sdk');
const DEMO_ROOT = 'c:/Users/kemomimi/Desktop/typescript/Demo4tests';
const sdk: Sdk = { name: '', path: SDK_DIR, moduleName: '' };

interface TestResult {
    projectName: string;
    sceneClasses: number;
    sceneMethods: number;
    abilities: number;
    components: number;
    navigations: number;
    dummyMainStmts: number;
    taintSourcesFound: number;
    taintSinksFound: number;
    resourceLeaks: number;
    taintLeaks: number;
    ifdsMethods: number;
    ifdsFacts: number;
    warnings: string[];
    errors: string[];
    duration: Record<string, number>;
}

function buildScene(projectPath: string): Scene {
    let config = new SceneConfig();
    config.buildConfig(projectPath, projectPath, [sdk]);
    config.buildFromProjectDir(projectPath);
    let scene = new Scene();
    scene.buildSceneFromProjectDir(config);
    scene.inferTypes();
    return scene;
}

async function runFullAnalysis(projectName: string, projectPath: string): Promise<TestResult> {
    const warnings: string[] = [];
    const errors: string[] = [];
    const duration: Record<string, number> = {};

    // 1. Scene 构建
    let sceneStart = Date.now();
    const scene = buildScene(projectPath);
    duration.scene = Date.now() - sceneStart;

    const sceneClasses = scene.getClasses().length;
    const sceneMethods = scene.getMethods().length;
    console.log(`  [${projectName}] Scene: ${sceneClasses} 类, ${sceneMethods} 方法 (${duration.scene}ms)`);

    // 2. Ability / Component 收集
    let collectStart = Date.now();
    const { AbilityCollector } = await import('../../../src/TEST_lifecycle/AbilityCollector');
    const collector = new AbilityCollector(scene);
    const abilities = collector.collectAllAbilities();
    const components = collector.collectAllComponents();
    duration.collect = Date.now() - collectStart;
    console.log(`  [${projectName}] Ability: ${abilities.length}, Component: ${components.length} (${duration.collect}ms)`);

    // 3. 导航分析
    let navStart = Date.now();
    const { NavigationAnalyzer } = await import('../../../src/TEST_lifecycle/NavigationAnalyzer');
    const navAnalyzer = new NavigationAnalyzer(scene);
    let navCount = 0;
    for (const ability of abilities) {
        const result = navAnalyzer.analyzeClass(ability.arkClass);
        navCount += result.navigationTargets.length;
    }
    duration.navigation = Date.now() - navStart;
    console.log(`  [${projectName}] 导航: ${navCount} (${duration.navigation}ms)`);

    // 4. DummyMain 构建
    let dummyStart = Date.now();
    let dummyMainStmts = 0;
    try {
        const { LifecycleModelCreator } = await import('../../../src/TEST_lifecycle/LifecycleModelCreator');
        const creator = new LifecycleModelCreator(scene);
        creator.create();
        const dm = creator.getDummyMain();
        if (dm?.getCfg()) {
            for (const block of dm.getCfg()!.getBlocks()) {
                dummyMainStmts += block.getStmts().length;
            }
        }
    } catch (e) {
        warnings.push(`DummyMain: ${e}`);
    }
    duration.dummyMain = Date.now() - dummyStart;
    console.log(`  [${projectName}] DummyMain: ${dummyMainStmts} 语句 (${duration.dummyMain}ms)`);

    // 5. SourceSinkManager 扫描
    let scanStart = Date.now();
    const { SourceSinkManager } = await import('../../../src/TEST_lifecycle/taint/SourceSinkManager');
    const ssm = new SourceSinkManager();
    let sourcesFound = 0;
    let sinksFound = 0;

    for (const method of scene.getMethods()) {
        const cfg = method.getCfg();
        if (!cfg) continue;
        for (const stmt of cfg.getStmts()) {
            const invokeExpr = stmt.getInvokeExpr?.();
            if (!invokeExpr) continue;
            const methodSig = invokeExpr.getMethodSignature();
            const callInfo = {
                className: methodSig.getDeclaringClassSignature().getClassName(),
                methodName: methodSig.getMethodSubSignature().getMethodName(),
            };
            if (ssm.isSource(callInfo)) sourcesFound++;
            if (ssm.isSink(callInfo)) sinksFound++;
        }
    }
    duration.scan = Date.now() - scanStart;
    console.log(`  [${projectName}] Source: ${sourcesFound}, Sink: ${sinksFound} (${duration.scan}ms)`);

    // 6. 完整 IFDS 污点分析
    let ifdsStart = Date.now();
    let resourceLeaks = 0;
    let taintLeaks = 0;
    let ifdsMethods = 0;
    let ifdsFacts = 0;
    try {
        const { TaintAnalysisRunner } = await import('../../../src/TEST_lifecycle/taint/TaintAnalysisSolver');
        const runner = new TaintAnalysisRunner(scene);
        const result = runner.runFromDummyMain();
        if (result.success) {
            resourceLeaks = result.resourceLeaks.length;
            taintLeaks = result.taintLeaks.length;
            ifdsMethods = result.statistics.analyzedMethods;
            ifdsFacts = result.statistics.totalFacts;
        } else {
            warnings.push(`IFDS: ${result.error}`);
        }
    } catch (e) {
        warnings.push(`IFDS 异常: ${e}`);
    }
    duration.ifds = Date.now() - ifdsStart;
    console.log(`  [${projectName}] IFDS: ${ifdsMethods} 方法, ${ifdsFacts} 事实, ${resourceLeaks} 资源泄漏, ${taintLeaks} 污点泄漏 (${duration.ifds}ms)`);

    return {
        projectName,
        sceneClasses,
        sceneMethods,
        abilities: abilities.length,
        components: components.length,
        navigations: navCount,
        dummyMainStmts,
        taintSourcesFound: sourcesFound,
        taintSinksFound: sinksFound,
        resourceLeaks,
        taintLeaks,
        ifdsMethods,
        ifdsFacts,
        warnings,
        errors,
        duration,
    };
}

// ============================================================================
// 测试 1: RingtoneKit（初级）
// ============================================================================

describe('Demo4tests: RingtoneKit_Codelab_Demo（初级）', () => {
    const PROJECT_PATH = path.join(DEMO_ROOT, 'RingtoneKit_Codelab_Demo');

    it('完整分析流程', async () => {
        console.log('\n=== RingtoneKit_Codelab_Demo ===');
        const result = await runFullAnalysis('RingtoneKit', PROJECT_PATH);

        expect(result.sceneClasses).toBeGreaterThan(0);
        expect(result.abilities).toBeGreaterThanOrEqual(1);
        expect(result.components).toBeGreaterThanOrEqual(1);
        expect(result.dummyMainStmts).toBeGreaterThan(0);
        expect(result.ifdsMethods).toBeGreaterThan(0);
        expect(result.ifdsFacts).toBeGreaterThan(0);
        expect(result.warnings.filter(w => w.includes('IFDS'))).toHaveLength(0);

        console.log(`  [RingtoneKit] 警告: ${result.warnings.join('; ') || '无'}`);
        console.log(`  [RingtoneKit] 总时间: ${Object.values(result.duration).reduce((a, b) => a + b, 0)}ms`);
    }, 60000);
});

// ============================================================================
// 测试 2: UIDesignKit（初级）
// ============================================================================

describe('Demo4tests: UIDesignKit_HdsNavigation（初级）', () => {
    const PROJECT_PATH = path.join(
        DEMO_ROOT,
        'UIDesignKit_HdsNavigation_Codelab',
        'UIDesignKit_HdsNavigation_Codelab',
        'UIDesignKit_HdsNavigation_Codelab',
        'UIDesignKit_HdsNavigation_Codelab'
    );

    it('完整分析流程', async () => {
        console.log('\n=== UIDesignKit_HdsNavigation ===');
        const result = await runFullAnalysis('UIDesignKit', PROJECT_PATH);

        expect(result.sceneClasses).toBeGreaterThan(0);
        expect(result.abilities).toBeGreaterThanOrEqual(1);
        expect(result.components).toBeGreaterThanOrEqual(1);
        expect(result.dummyMainStmts).toBeGreaterThan(0);
        expect(result.ifdsMethods).toBeGreaterThan(0);
        expect(result.ifdsFacts).toBeGreaterThan(0);
        expect(result.warnings.filter(w => w.includes('IFDS'))).toHaveLength(0);

        console.log(`  [UIDesignKit] 警告: ${result.warnings.join('; ') || '无'}`);
        console.log(`  [UIDesignKit] 总时间: ${Object.values(result.duration).reduce((a, b) => a + b, 0)}ms`);
    }, 60000);
});

// ============================================================================
// 测试 3: CloudFoundationKit（中级）
// ============================================================================

describe('Demo4tests: CloudFoundationKit_Prefetch（中级）', () => {
    const PROJECT_PATH = path.join(
        DEMO_ROOT,
        'CloudFoundationKit_Codelab_Prefetch_ArkTS',
        'prefetch-code-lab'
    );

    it('完整分析流程', async () => {
        console.log('\n=== CloudFoundationKit ===');
        const result = await runFullAnalysis('CloudFoundation', PROJECT_PATH);

        expect(result.sceneClasses).toBeGreaterThan(0);
        expect(result.abilities).toBeGreaterThanOrEqual(1);
        expect(result.components).toBeGreaterThanOrEqual(1);
        expect(result.dummyMainStmts).toBeGreaterThan(0);
        expect(result.ifdsMethods).toBeGreaterThan(0);
        expect(result.ifdsFacts).toBeGreaterThan(0);
        expect(result.warnings.filter(w => w.includes('IFDS'))).toHaveLength(0);

        console.log(`  [CloudFoundation] 警告: ${result.warnings.join('; ') || '无'}`);
        console.log(`  [CloudFoundation] 总时间: ${Object.values(result.duration).reduce((a, b) => a + b, 0)}ms`);
    }, 60000);
});

// ============================================================================
// 测试 4: OxHornCampus（高级）
// ============================================================================

describe('Demo4tests: OxHornCampus（高级）', () => {
    const PROJECT_PATH = path.join(DEMO_ROOT, 'OxHornCampus', 'OxHornCampus');

    it('完整分析流程', async () => {
        console.log('\n=== OxHornCampus ===');
        const result = await runFullAnalysis('OxHornCampus', PROJECT_PATH);

        expect(result.sceneClasses).toBeGreaterThan(0);
        expect(result.abilities).toBeGreaterThanOrEqual(1);
        expect(result.dummyMainStmts).toBeGreaterThan(0);
        expect(result.ifdsMethods).toBeGreaterThan(0);
        expect(result.ifdsFacts).toBeGreaterThan(0);
        expect(result.warnings.filter(w => w.includes('IFDS'))).toHaveLength(0);

        console.log(`  [OxHornCampus] 警告: ${result.warnings.join('; ') || '无'}`);
        console.log(`  [OxHornCampus] 总时间: ${Object.values(result.duration).reduce((a, b) => a + b, 0)}ms`);
    }, 120000);
});
