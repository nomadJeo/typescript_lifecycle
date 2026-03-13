/**
 * 诊断脚本：检查 ClickUtil.ets 中 setTimeout 语句所在方法的 CFG 直接语句
 * 以确认 clearTimeout 是否出现在 setTimeout Source 所在方法的直接语句中，
 * 还是在独立的 lambda ArkMethod 里。
 */
import path from 'path';
import { SceneConfig } from '../src/Config';
import { Scene } from '../src/Scene';
import { ArkInvokeStmt, ArkAssignStmt } from '../src/core/base/Stmt';

const PROJECT_PATH = path.resolve(__dirname, '../../../Demo4tests/harmony-utils-master');

async function main() {
    const config = new SceneConfig();
    config.buildFromProjectDir(PROJECT_PATH);
    const scene = new Scene();
    scene.buildSceneFromProjectDir(config);

    const TARGET_METHODS = ['clearTimeout', 'clearInterval', 'setTimeout', 'setInterval'];

    for (const method of scene.getMethods()) {
        const cfg = method.getCfg();
        if (!cfg) continue;
        const sig = method.getSignature().toString();
        if (!sig.includes('ClickUtil') && !sig.includes('SpinKit')) continue;

        let hasSrc = false;
        let hasSink = false;
        const stmtNames: string[] = [];

        for (const block of cfg.getBlocks()) {
            for (const stmt of block.getStmts()) {
                let invokeExpr: any = null;
                if (stmt instanceof ArkInvokeStmt) invokeExpr = stmt.getInvokeExpr();
                else if (stmt instanceof ArkAssignStmt) {
                    const r = stmt.getRightOp();
                    if (r && (r as any).getMethodSignature) invokeExpr = r;
                }
                if (!invokeExpr) continue;
                const name = invokeExpr.getMethodSignature?.()?.getMethodSubSignature?.()?.getMethodName?.() ?? '';
                if (!TARGET_METHODS.includes(name)) continue;
                stmtNames.push(name);
                if (name === 'setTimeout' || name === 'setInterval') hasSrc = true;
                if (name === 'clearTimeout' || name === 'clearInterval') hasSink = true;
            }
        }

        if (stmtNames.length > 0) {
            const blockCount = [...cfg.getBlocks()].length;
            console.log(`\nMethod: ${sig}`);
            console.log(`  Direct stmts with timer calls: [${stmtNames.join(', ')}]`);
            console.log(`  hasSource=${hasSrc}, hasSink=${hasSink}, blockCount=${blockCount}`);
        }
    }

    console.log('\nDone.');
}

main().catch(console.error);
