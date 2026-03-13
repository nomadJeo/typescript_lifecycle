/**
 * 对 Demo4tests 下新增项目运行 LifecycleAnalyzer（排除 LinysBrowser_NEXT-master）
 * 包含所有历史项目 + 15 个新增项目
 */
import path from 'path';
import fs from 'fs';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');

// 全量：33 个历史项目 + 15 个新增项目 = 48 个
const PROJECT_PATHS: [string, string][] = [
  // ===== 原 33 个历史项目 =====
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
  ['CoolMallArkTS-main', 'CoolMallArkTS-main'],
  ['ElderMate-main', 'ElderMate-main'],
  ['jingmo-for-HarmonyOS-main', 'jingmo-for-HarmonyOS-main'],
  ['MiShop_HarmonyOS-main', 'MiShop_HarmonyOS-main'],
  // ===== 新增 15 个项目 =====
  ['Aigis-master', 'Aigis-master'],
  ['ccplayer-main', 'ccplayer-main'],
  ['ExploreHarmonyNext-master', 'ExploreHarmonyNext-master'],
  ['FinVideo-master', 'FinVideo-master'],
  ['Harflix-master', 'Harflix-master'],
  ['HarmonyKit-main', 'HarmonyKit-main'],
  ['HarmonyOS-mall-main', 'HarmonyOS-mall-main'],
  ['HarmonyUtilCode-master', 'HarmonyUtilCode-master'],
  ['JellyFin_HarmonyOS-main', 'JellyFin_HarmonyOS-main'],
  ['KeePassHO-main', 'KeePassHO-main'],
  ['mcCharts-dev', 'mcCharts-dev'],
  ['ohos_electron_hap-main', 'ohos_electron_hap-main'],
  ['rdbStore-main', 'rdbStore-main'],
  ['rich-text-vista-main', 'rich-text-vista-main'],
  ['Youtube-Music-ArkTS-Clone-main', 'Youtube-Music-ArkTS-Clone-main'],
  ['LinysBrowser_NEXT-master', 'LinysBrowser_NEXT-master'],
];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: false, runTaintAnalysis: true });
  const results: Array<Record<string, unknown>> = [];

  for (const [name, relPath] of PROJECT_PATHS) {
    const projectPath = path.join(DEMO_ROOT, relPath);
    if (!fs.existsSync(projectPath)) {
      results.push({ project: name, error: 'Path not found' });
      console.log(`\n=== ${name} ===`);
      console.log(`  ERROR: Path not found: ${projectPath}`);
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
  const outPath = path.join(__dirname, '../analyze-new-results.json');
  fs.writeFileSync(outPath, summary, 'utf-8');
  console.log(`\nResults saved to ${outPath}`);
}

main().catch(console.error);
