/**
 * 获取 5 个项目的资源泄漏详情（文件、行号）
 */
import path from 'path';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');
const PROJECTS = ['ClashBox-master', 'interview-handbook-project-next'];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: false, runTaintAnalysis: true });
  for (const name of PROJECTS) {
    const projectPath = path.join(DEMO_ROOT, name);
    const result = await analyzer.analyze(projectPath);
    const leaks = result.taintAnalysis?.resourceLeaks ?? [];
    console.log(`\n=== ${name} (${leaks.length} resource leaks) ===`);
    leaks.forEach((l, i) => {
      const loc = l.sourceLocation;
      console.log(`${i + 1}. [${l.category}] ${l.resourceType} | 预期: ${l.expectedSink}`);
      console.log(`   ${loc.filePath}:${loc.line}:${loc.col}`);
      console.log(`   ${l.description}`);
    });
  }
}

main().catch(console.error);
