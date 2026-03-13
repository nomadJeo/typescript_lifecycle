/*
 * Copyright (c) 2024-2025 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file gui/server.ts
 * @description GUI 后端服务 - 基于 HTTP 的简单 Web 服务器
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import * as url from 'url';
import { LifecycleAnalyzer } from '../cli/LifecycleAnalyzer';
import { ReportGenerator } from '../cli/ReportGenerator';

const PORT = 3000;
const GUI_DIR = __dirname;

// MIME 类型映射
const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

/**
 * 发送 JSON 响应
 */
function sendJSON(res: http.ServerResponse, data: any, statusCode: number = 200): void {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(data));
}

/**
 * 发送静态文件
 */
function sendFile(res: http.ServerResponse, filePath: string): void {
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { 'Content-Type': mimeType });
        res.end(data);
    });
}

/**
 * 解析 POST 请求体
 */
function parseBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(e);
            }
        });
        req.on('error', reject);
    });
}

/**
 * 处理分析请求
 */
async function handleAnalyze(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
        const body = await parseBody(req);
        const { projectPath, options } = body;
        
        if (!projectPath) {
            sendJSON(res, { error: '请提供项目路径' }, 400);
            return;
        }
        
        // 验证路径存在
        if (!fs.existsSync(projectPath)) {
            sendJSON(res, { error: `项目路径不存在: ${projectPath}` }, 400);
            return;
        }
        
        console.log(`[Server] 开始分析: ${projectPath}`);
        
        const analyzer = new LifecycleAnalyzer({
            verbose: true,
            inferTypes: options?.inferTypes !== false,
            generateDummyMain: options?.generateDummyMain !== false,
            analyzeNavigation: options?.analyzeNavigation !== false,
            extractUICallbacks: options?.extractUICallbacks !== false,
            detectResourceLeaks: options?.detectResourceLeaks !== false,
            runTaintAnalysis: options?.runTaintAnalysis !== false,
            bounds: options?.bounds,
        });
        
        const result = await analyzer.analyze(projectPath);
        
        console.log(`[Server] 分析完成，耗时 ${result.duration.total}ms`);
        
        sendJSON(res, { success: true, result });
    } catch (error: unknown) {
        console.error('[Server] 分析错误:', error);
        const err = error instanceof Error ? error : new Error(String(error));
        const payload: { error: string; detail?: string } = { error: err.message };
        if (err.stack) payload.detail = err.stack;
        sendJSON(res, payload, 500);
    }
}

/**
 * 处理报告生成请求
 */
async function handleReport(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    try {
        const body = await parseBody(req);
        const { result, format, title } = body;
        
        if (!result) {
            sendJSON(res, { error: '请提供分析结果' }, 400);
            return;
        }
        
        const generator = new ReportGenerator();
        const report = generator.generate(result, {
            format: format || 'html',
            detailed: true,
            title: title || 'HarmonyOS 生命周期分析报告',
        });
        
        sendJSON(res, { success: true, report });
    } catch (error) {
        console.error('[Server] 报告生成错误:', error);
        sendJSON(res, { error: String(error) }, 500);
    }
}

/**
 * 处理验证路径请求
 */
function handleValidatePath(req: http.IncomingMessage, res: http.ServerResponse): void {
    const parsedUrl = url.parse(req.url || '', true);
    const projectPath = parsedUrl.query.path as string;
    
    if (!projectPath) {
        sendJSON(res, { valid: false, message: '未提供路径' });
        return;
    }
    
    const exists = fs.existsSync(projectPath);
    const isDirectory = exists && fs.statSync(projectPath).isDirectory();
    
    // 检查是否包含 HarmonyOS 项目特征
    let hasModuleJson = false;
    let hasEtsFiles = false;
    
    if (isDirectory) {
        try {
            const checkDir = (dir: string, depth: number = 0): void => {
                if (depth > 3) return;
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    if (file === 'module.json5' || file === 'module.json') {
                        hasModuleJson = true;
                    }
                    if (file.endsWith('.ets')) {
                        hasEtsFiles = true;
                    }
                    const fullPath = path.join(dir, file);
                    if (fs.statSync(fullPath).isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
                        checkDir(fullPath, depth + 1);
                    }
                }
            };
            checkDir(projectPath);
        } catch (e) {
            // 忽略权限错误
        }
    }
    
    sendJSON(res, {
        valid: isDirectory,
        exists,
        isDirectory,
        hasModuleJson,
        hasEtsFiles,
        message: !exists ? '路径不存在' : 
                 !isDirectory ? '不是目录' : 
                 !hasModuleJson ? '未找到 module.json5（可能不是 HarmonyOS 项目）' :
                 '有效的 HarmonyOS 项目路径',
    });
}

/**
 * 请求处理器
 */
async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = url.parse(req.url || '', true);
    const pathname = parsedUrl.pathname || '/';
    
    // CORS 预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
    }
    
    // API 路由
    if (pathname === '/api/analyze' && req.method === 'POST') {
        await handleAnalyze(req, res);
        return;
    }
    
    if (pathname === '/api/report' && req.method === 'POST') {
        await handleReport(req, res);
        return;
    }
    
    if (pathname === '/api/validate' && req.method === 'GET') {
        handleValidatePath(req, res);
        return;
    }
    
    // 静态文件
    let filePath = pathname === '/' ? '/index.html' : pathname;
    filePath = path.join(GUI_DIR, filePath);
    
    // 安全检查
    if (!filePath.startsWith(GUI_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    sendFile(res, filePath);
}

/**
 * 启动服务器
 */
export function startServer(port: number = PORT): http.Server {
    const server = http.createServer(handleRequest);
    
    server.listen(port, () => {
        console.log('');
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     HarmonyOS 生命周期分析工具 - GUI 服务已启动              ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║     访问地址: http://localhost:${port}                        ║`);
        console.log('╚════════════════════════════════════════════════════════════╝');
        console.log('');
        if (process.env.OPEN_BROWSER === '1') {
            const url = `http://localhost:${port}`;
            const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
            exec(cmd, () => {});
        }
    });
    
    return server;
}

// 直接运行时启动服务器
if (require.main === module) {
    startServer();
}
