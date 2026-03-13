/**
 * 测试 ID 未保存 setTimeout FN 修复效果 + 全套回归
 */
import path from 'path';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');

const PROJECTS: [string, string][] = [
  ['KeePassHO-main', 'KeePassHO-main'],               // 目标: LoadingDialogUtils:25 FN 应出现，leaks=1
  ['LinysBrowser_NEXT-master', 'LinysBrowser_NEXT-master'],  // 目标: meowTitleBar:664 FN 应出现，leaks=3
  ['MusicHome', 'MusicHome'],                          // 回归：setInterval TP 仍为1
  ['HarmonyUtilCode-master', 'HarmonyUtilCode-master'], // 回归：throttle 防抖，leaks 不变
  ['harmony-utils-master', 'harmony-utils-master'],    // 回归：检查无新增 FP
  ['Gramony-dev', 'Gramony-dev'],                      // 回归：无 File FP
];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: false, runTaintAnalysis: true });

  for (const [name, relPath] of PROJECTS) {
    const projectPath = path.join(DEMO_ROOT, relPath);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`RESULT: ${name}`);
    console.log(`${'='.repeat(60)}`);
    try {
      const result = await analyzer.analyze(projectPath);
      const r = result as any;
      const leaks: any[] = r.taintAnalysis?.resourceLeaks ?? [];
      const summary = r.summary ?? {};
      console.log(`  files:   ${summary.totalFiles ?? '?'}`);
      console.log(`  leaks:   ${leaks.length}`);

      for (let i = 0; i < leaks.length; i++) {
        const leak = leaks[i];
        const loc = leak.sourceLocation ?? {};
        const filePath: string = loc.filePath ?? '';
        const line: number = loc.line ?? 0;
        console.log(`  [${i+1}] ${leak.resourceType} @ ${path.basename(filePath)}:${line}`);
      }
    } catch (e: any) {
      console.error(`  ERROR: ${e?.message ?? e}`);
    }
  }
}

main().catch(console.error);
