/*
 * GUI 启动脚本
 * 
 * 使用方法:
 *   npx ts-node --transpile-only src/TEST_lifecycle/gui/start.ts
 */

import { startServer } from './server';

console.log('正在启动 HarmonyOS 生命周期分析工具...');
startServer(3000);
