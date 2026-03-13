/**
 * 快速测试脚本：只针对 HarmonyUtilCode-master 和 JellyFin_HarmonyOS-main
 */
import path from 'path';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');

const PROJECT_PATHS: [string, string][] = [
  ['MusicHome', 'MusicHome'],
  ['harmony-utils-master', 'harmony-utils-master'],
  ['HarmonyUtilCode-master', 'HarmonyUtilCode-master'],
  ['Gramony-dev', 'Gramony-dev'],
  ['interview-handbook-project-next', 'interview-handbook-project-next'],
  ['Youtube-Music-ArkTS-Clone-main', 'Youtube-Music-ArkTS-Clone-main'],
  ['ohos_electron_hap-main', 'ohos_electron_hap-main'],
];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: false, runTaintAnalysis: true });
  console.log('=== 快速测试：HarmonyUtilCode + JellyFin ===\n');
  for (const [label, rel] of PROJECT_PATHS) {
    const projectPath = path.join(DEMO_ROOT, rel);
    console.log(`\n--- [${label}] ---`);
    try {
      const result = await analyzer.analyze(projectPath);
      const leaks = result.taintAnalysis?.resourceLeaks ?? [];
      console.log(`  sources=${result.summary.sourceCount ?? 0}, sinks=${result.summary.sinkCount ?? 0}, resourceLeaks=${leaks.length}`);
      if (leaks.length > 0) {
        for (const leak of leaks) {
          console.log(`  [LEAK] ${leak.resourceType} @ line ${leak.sourceLocation.line} in ${path.basename(leak.sourceLocation.filePath)}`);
        }
      } else {
        console.log('  (no leaks)');
      }
    } catch (e: any) {
      console.error(`  ERROR: ${e?.message ?? e}`);
    }
  }
  console.log('\n=== Done ===');
}

main().catch(console.error);
