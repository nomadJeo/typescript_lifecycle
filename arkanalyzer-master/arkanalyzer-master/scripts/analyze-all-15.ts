/**
 * 对 Demo4tests 下 15 个项目运行 LifecycleAnalyzer
 */
import path from 'path';
import fs from 'fs';
import { LifecycleAnalyzer } from '../src/TEST_lifecycle/cli/LifecycleAnalyzer';

const DEMO_ROOT = path.resolve(__dirname, '../../../Demo4tests');

// 15 个项目：5 原项目 + 10 个新增
const PROJECT_PATHS: [string, string][] = [
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
      results.push({
        project: name,
        files: result.summary.totalFiles,
        abilities: result.summary.abilityCount,
        components: result.summary.componentCount,
        sources: result.summary.sourceCount ?? 0,
        sinks: result.summary.sinkCount ?? 0,
        resourceLeaks: result.summary.resourceLeakCount,
        taintLeaks: result.summary.taintLeakCount ?? 0,
        leakDetails: leaks.map((l) => ({
          type: l.resourceType,
          file: l.sourceLocation.filePath,
          line: l.sourceLocation.line,
          expected: l.expectedSink,
        })),
      });
      console.log(`  ResourceLeaks: ${leaks.length}`);
    } catch (e) {
      results.push({ project: name, error: (e as Error).message });
      console.log(`  ERROR: ${(e as Error).message}`);
    }
  }

  console.log('\n\n========== SUMMARY ==========');
  const summary = JSON.stringify(results, null, 2);
  console.log(summary);
  const outPath = path.join(__dirname, '../analyze-15-results.json');
  fs.writeFileSync(outPath, summary, 'utf-8');
  console.log(`\nResults saved to ${outPath}`);
}

main().catch(console.error);
