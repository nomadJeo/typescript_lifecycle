/**
 * 对 Demo4tests 下项目运行 LifecycleAnalyzer（排除 LinysBrowser_NEXT-master）
 */
import path from 'path';
import fs from 'fs';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');

// 33 个项目（30 原项目 + 4 新增 - 1 LinysBrowser）
const PROJECT_PATHS: [string, string][] = [
  // 原 15 个
  ['Accouting_ArkTS-master', 'Accouting_ArkTS-master'],
  ['ClashBox-master', 'ClashBox-master'],
  ['HarmoneyOpenEye-master', 'HarmoneyOpenEye-master'],
  ['interview-handbook-project-next', 'interview-handbook-project-next'],
  ['open_neteasy_cloud-main', 'open_neteasy_cloud-main'],
  ['RingtoneKit_Codelab_Demo', 'RingtoneKit_Codelab_Demo'],
  ['OxHornCampus', 'OxHornCampus/OxHornCampus'],
  ['CloudFoundationKit', 'CloudFoundationKit_Codelab_Prefetch_ArkTS/prefetch-code-lab'],
  ['UIDesignKit_Nav', 'UIDesignKit_HdsNavigation_Codelab/UIDesignKit_HdsNavigation_Codelab/UIDesignKit_HdsNavigation_Codelab/UIDesignKit_HdsNavigation_Codelab'],
  ['MultiVideoApplication', 'MultiVideoApplication'],
  ['MusicHome', 'MusicHome'],
  ['DistributedMail', 'DistributedMail'],
  ['Transition_Before', 'TransitionPerformanceIssue/BeforeOptimization'],
  ['ColdStart_Before', 'ColdStartPerformanceIssue-master/BeforeOptimization'],
  ['PageSlip_Before', 'PageSlipPerformanceIssue-master/BeforeOptimization'],
  // 原新增 15 个（去除 LinysBrowser）
  ['account_app_harmonyos-master', 'account_app_harmonyos-master'],
  ['AnimeZ-main', 'AnimeZ-main'],
  ['arkTS-next', 'arkTS-next'],
  ['browser-master', 'browser-master'],
  ['CloudMusic-HarmonyOSNext-master', 'CloudMusic-HarmonyOSNext-master'],
  ['echo-master', 'echo-master'],
  ['Gramony-dev', 'Gramony-dev'],
  ['harmony-utils-master', 'harmony-utils-master'],
  ['HarmonyAtomicService-main', 'HarmonyAtomicService-main'],
  ['HarmonyOS-master', 'HarmonyOS-master'],
  ['HarmonyOsRefresh-master', 'HarmonyOsRefresh-master'],
  ['Homogram-dev', 'Homogram-dev'],
  ['Melotopia-HMOS-master', 'Melotopia-HMOS-master'],
  ['Wechat_HarmonyOS-main', 'Wechat_HarmonyOS-main'],
  // 新增 4 个
  ['CoolMallArkTS-main', 'CoolMallArkTS-main'],
  ['ElderMate-main', 'ElderMate-main'],
  ['jingmo-for-HarmonyOS-main', 'jingmo-for-HarmonyOS-main'],
  ['MiShop_HarmonyOS-main', 'MiShop_HarmonyOS-main'],
];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: false, runTaintAnalysis: true });
  const results: Array<Record<string, unknown>> = [];

  for (const [name, relPath] of PROJECT_PATHS) {
    const projectPath = path.join(DEMO_ROOT, relPath);
    if (!fs.existsSync(projectPath)) {
      results.push({ project: name, error: 'Path not found' });
      continue;
    }
    console.log(`\n=== ${name} ===`);
    try {
      const result = await analyzer.analyze(projectPath);
      const leaks = result.taintAnalysis?.resourceLeaks ?? [];
      const entry: Record<string, unknown> = {
        project: name,
        files: result.summary.totalFiles,
        abilities: result.summary.abilityCount,
        components: result.summary.componentCount,
        sources: result.summary.sourceCount ?? 0,
        sinks: result.summary.sinkCount ?? 0,
        resourceLeaks: result.summary.resourceLeakCount,
        taintLeaks: result.summary.taintLeakCount ?? 0,
        leakDetails: leaks.map((l: { resourceType: string; sourceLocation: { filePath: string; line: number }; expectedSink: string }) => ({
          type: l.resourceType,
          file: l.sourceLocation.filePath,
          line: l.sourceLocation.line,
          expected: l.expectedSink,
        })),
      };
      if (result.errors && result.errors.length > 0) {
        entry.error = result.errors.join('; ');
      }
      results.push(entry);
      console.log(result.errors?.length ? `  ERROR (graceful): ${result.errors[0]}` : `  ResourceLeaks: ${leaks.length}`);
    } catch (e) {
      results.push({ project: name, error: (e as Error).message });
      console.log(`  ERROR: ${(e as Error).message}`);
    }
  }

  console.log('\n\n========== SUMMARY ==========');
  const summary = JSON.stringify(results, null, 2);
  console.log(summary);
  const outPath = path.join(__dirname, '../analyze-30-results.json');
  fs.writeFileSync(outPath, summary, 'utf-8');
  console.log(`\nResults saved to ${outPath}`);
}

main().catch(console.error);