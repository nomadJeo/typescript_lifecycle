/**
 * 诊断脚本：精确定位 KeePassHO/LinysBrowser 栈溢出的发生阶段
 */
import path from 'path';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const PROJECTS: [string, string][] = [
  ['KeePassHO-main', path.resolve(__dirname, '../../../Demo4tests/KeePassHO-main')],
  // LinysBrowser 结构不同，主模块在 home
  ['LinysBrowser_NEXT-master', path.resolve(__dirname, '../../../Demo4tests/LinysBrowser_NEXT-master')],
];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: true, runTaintAnalysis: true });
  for (const [label, projectPath] of PROJECTS) {
    console.log(`\n\n==============================`);
    console.log(`=== ${label} ===`);
    console.log(`==============================`);
    try {
      const result = await analyzer.analyze(projectPath);
      const leaks = result.taintAnalysis?.resourceLeaks ?? [];
      console.log(`\n  sources=${result.summary.sourceCount ?? 0}, sinks=${result.summary.sinkCount ?? 0}, resourceLeaks=${leaks.length}`);
      for (const leak of leaks) {
        console.log(`  [LEAK] ${leak.resourceType} @ line ${leak.sourceLocation.line} in ${path.basename(leak.sourceLocation.filePath)}`);
      }
    } catch (e: any) {
      const stack: string = e?.stack ?? String(e);
      // 打印栈追踪前 40 行
      const lines = stack.split('\n').slice(0, 40);
      console.error('\n[ERROR]', lines.join('\n'));
    }
  }
  console.log('\n=== Done ===');
}

main().catch(console.error);
