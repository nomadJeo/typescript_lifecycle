/**
 * 诊断脚本：检查 Youtube-Music 中 createAVPlayer/subscribe 的 IR 表示
 */
import path from 'path';
import { SceneConfig } from '../src/Config';
import { Scene } from '../src/Scene';
import { ArkInvokeStmt, ArkAssignStmt } from '../src/core/base/Stmt';
import { ArkInstanceInvokeExpr, ArkStaticInvokeExpr } from '../src/core/base/Expr';

const YOUTUBE_PATH = path.resolve(__dirname, '../../../Demo4tests/Youtube-Music-ArkTS-Clone-main');
const ELECTRON_PATH = path.resolve(__dirname, '../../../Demo4tests/ohos_electron_hap-main');

const TARGET_METHODS = ['createAVPlayer', 'release', 'createSubscriber', 'subscribe', 'unsubscribe'];

async function analyzeProject(projectPath: string, label: string) {
  console.log(`\n\n========== ${label} ==========`);
  const config = new SceneConfig();
  config.buildFromProjectDir(projectPath);
  const scene = new Scene();
  scene.buildSceneFromProjectDir(config);

  for (const method of scene.getMethods()) {
    const cfg = method.getCfg();
    if (!cfg) continue;

    for (const block of cfg.getBlocks()) {
      for (const stmt of block.getStmts()) {
        let invokeExpr: ArkInstanceInvokeExpr | ArkStaticInvokeExpr | null = null;
        if (stmt instanceof ArkInvokeStmt) {
          const e = stmt.getInvokeExpr();
          if (e instanceof ArkInstanceInvokeExpr || e instanceof ArkStaticInvokeExpr) invokeExpr = e;
        } else if (stmt instanceof ArkAssignStmt) {
          const r = stmt.getRightOp();
          if (r instanceof ArkInstanceInvokeExpr || r instanceof ArkStaticInvokeExpr) invokeExpr = r as any;
        }
        if (!invokeExpr) continue;

        const methodSig = invokeExpr.getMethodSignature();
        const methodName = methodSig.getMethodSubSignature().getMethodName();
        if (!TARGET_METHODS.includes(methodName)) continue;

        const className = methodSig.getDeclaringClassSignature().getClassName();
        const fullSig = methodSig.toString();
        console.log(`\n  [FOUND] methodName=${methodName}`);
        console.log(`    className=${className}`);
        console.log(`    fullSig=${fullSig.substring(0, 120)}`);
        console.log(`    stmt=${stmt.toString().substring(0, 100)}`);
      }
    }
  }
}

async function main() {
  await analyzeProject(YOUTUBE_PATH, 'Youtube-Music-ArkTS-Clone-main');
  await analyzeProject(ELECTRON_PATH, 'ohos_electron_hap-main');
  console.log('\n=== Done ===');
}

main().catch(console.error);
