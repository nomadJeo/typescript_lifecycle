/**
 * 诊断脚本：分析 HarmonyUtilCode throttle.ts 中 wrapper 和 clearExistingTimeout 的 IR 结构
 */
import path from 'path';
import { SceneConfig } from '../src/Config';
import { Scene } from '../src/Scene';
import { ArkInvokeStmt, ArkAssignStmt } from '../src/core/base/Stmt';

const PROJECT_PATH = path.resolve(__dirname, '../../../Demo4tests/HarmonyUtilCode-master');

async function main() {
  const config = new SceneConfig();
  config.buildFromProjectDir(PROJECT_PATH);
  const scene = new Scene();
  scene.buildSceneFromProjectDir(config);

  const TARGET_METHODS = ['clearTimeout', 'clearInterval', 'setTimeout', 'setInterval'];

  for (const method of scene.getMethods()) {
    const sig = method.getSignature().toString();
    if (!sig.toLowerCase().includes('throttle')) continue;

    const cfg = method.getCfg();
    if (!cfg) {
      console.log(`[NO CFG] ${sig}`);
      continue;
    }

    const blocks = [...cfg.getBlocks()];
    let hasTimer = false;
    const timerCalls: string[] = [];

    for (const block of blocks) {
      for (const stmt of block.getStmts()) {
        let invokeExpr: any = null;
        if (stmt instanceof ArkInvokeStmt) invokeExpr = stmt.getInvokeExpr();
        else if (stmt instanceof ArkAssignStmt) {
          const r = stmt.getRightOp();
          if (r && (r as any).getMethodSignature) invokeExpr = r;
        }
        if (!invokeExpr) continue;
        const name = invokeExpr.getMethodSignature?.()?.getMethodSubSignature?.()?.getMethodName?.() ?? '';
        if (TARGET_METHODS.includes(name)) {
          timerCalls.push(name);
          hasTimer = true;
        }
      }
    }

    console.log(`\n[METHOD] ${sig}`);
    console.log(`  blockCount=${blocks.length}, timerCalls=[${timerCalls.join(', ')}]`);

    if (hasTimer) {
      // 打印完整方法结构
      for (const block of blocks) {
        console.log(`  [BLOCK id=${block.getId()}]`);
        for (const stmt of block.getStmts()) {
          const stmtStr = stmt.toString().substring(0, 120);
          console.log(`    ${stmtStr}`);
        }
      }
    }
  }
}

main().catch(console.error);
