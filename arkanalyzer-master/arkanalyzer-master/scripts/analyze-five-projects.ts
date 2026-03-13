/**
 * 对 Demo4tests 下 5 个新项目运行 LifecycleAnalyzer，输出统计结果
 */
import path from 'path';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');

const PROJECTS = [
  'Accouting_ArkTS-master',
  'ClashBox-master',
  'HarmoneyOpenEye-master',
  'interview-handbook-project-next',
  'open_neteasy_cloud-main',
];

async function main() {
  const analyzer = new LifecycleAnalyzer({ verbose: false, runTaintAnalysis: true });
  const results: Array<Record<string, unknown>> = [];

  for (const name of PROJECTS) {
    const projectPath = path.join(DEMO_ROOT, name);
    console.log(`\n========== Analyzing: ${name} ==========`);
    try {
      const result = await analyzer.analyze(projectPath);
      results.push({
        project: name,
        files: result.summary.totalFiles,
        classes: result.summary.totalClasses,
        abilities: result.summary.abilityCount,
        components: result.summary.componentCount,
        sources: result.summary.sourceCount ?? '-',
        sinks: result.summary.sinkCount ?? '-',
        resourceLeaks: result.summary.resourceLeakCount,
        taintLeaks: result.summary.taintLeakCount ?? '-',
        durationMs: result.duration.total,
      });
      console.log('  Sources:', result.summary.sourceCount ?? 0);
      console.log('  Sinks:', result.summary.sinkCount ?? 0);
      console.log('  ResourceLeaks:', result.summary.resourceLeakCount);
      console.log('  TaintLeaks:', result.summary.taintLeakCount ?? 0);
      console.log('  Duration:', result.duration.total, 'ms');
    } catch (e) {
      results.push({ project: name, error: String(e) });
      console.log('  ERROR:', (e as Error).message);
    }
  }

  console.log('\n\n========== SUMMARY (JSON) ==========');
  console.log(JSON.stringify(results, null, 2));
}

main().catch(console.error);
