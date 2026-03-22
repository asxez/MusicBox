// HTTP 服务器控制器

import * as http from 'http';
import {ipcMain} from 'electron';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';

interface ServerConfig {
    port: number;
    host: string;
    maxConnections: number;
    cors: boolean;

    [key: string]: any;
}

interface ServerInfo {
    server: http.Server;
    config: ServerConfig;
    isRunning: boolean;
    startTime: number | null;
    requestHandlers: Map<string, string>; // 'METHOD:path' -> handlerId
    webContents: Electron.WebContents | null;
}

@Controller('httpServer')
export class HttpServerController extends BaseController {
    private servers = new Map<string, ServerInfo>();
    private serverIdCounter = 0;
    private pendingRequests = new Map<string, { resolve: (v: any) => void; timeout: NodeJS.Timeout }>();

    constructor() {
        super();
    }

    override register(): void {
        super.register();
        // response handler uses ipcMain.on (not decorated)
        if (!(global as any)._httpResponseHandlerSetup) {
            ipcMain.on('httpServer:handleResponse', (_event, responseData) => {
                const pending = this.pendingRequests.get(responseData?.requestId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    pending.resolve(responseData);
                    this.pendingRequests.delete(responseData?.requestId);
                }
            });
            (global as any)._httpResponseHandlerSetup = true;
        }
        // httpServer:start needs raw event.sender — register manually
        ipcMain.handle('httpServer:start', async (event, serverId: string) => {
            return this.startServer(event.sender, serverId);
        });
    }

    @IpcHandle('httpServer:create')
    async create(config: Partial<ServerConfig>): Promise<{
        success: boolean;
        serverId?: string;
        config?: ServerConfig;
        error?: string
    }> {
        try {
            const serverId = `server_${++this.serverIdCounter}`;
            const serverConfig: ServerConfig = {
                port: config.port || 8899,
                host: config.host || 'localhost',
                maxConnections: config.maxConnections || 50,
                cors: config.cors !== false,
                ...config
            };
            const server = http.createServer();
            server.maxConnections = serverConfig.maxConnections;
            this.servers.set(serverId, {
                server, config: serverConfig, isRunning: false,
                startTime: null, requestHandlers: new Map(), webContents: null
            });
            return {success: true, serverId, config: serverConfig};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('httpServer:registerHandler')
    async registerHandler(serverId: string, method: string, handlerPath: string, handlerId: string): Promise<any> {
        try {
            const info = this.servers.get(serverId);
            if (!info) throw new Error(`服务器不存在: ${serverId}`);
            info.requestHandlers.set(`${method.toUpperCase()}:${handlerPath}`, handlerId);
            return {success: true, serverId, method, path: handlerPath, handlerId};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    private async startServer(sender: Electron.WebContents, serverId: string): Promise<any> {
        try {
            const info = this.servers.get(serverId);
            if (!info) throw new Error(`服务器不存在: ${serverId}`);
            if (info.isRunning) {
                return {
                    success: true,
                    message: '服务器已在运行',
                    url: `http://${info.config.host}:${info.config.port}`
                };
            }

            info.webContents = sender;
            info.server.on('request', async (req, res) => {
                await this.handleRequest(req, res, info);
            });

            return new Promise(resolve => {
                info.server.listen(info.config.port, info.config.host, () => {
                    info.isRunning = true;
                    info.startTime = Date.now();
                    resolve({success: true, serverId, url: `http://${info.config.host}:${info.config.port}`});
                });
                info.server.on('error', (err: any) => resolve({success: false, error: err.message}));
            });
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('httpServer:stop')
    async stop(serverId: string): Promise<any> {
        try {
            const info = this.servers.get(serverId);
            if (!info) throw new Error(`服务器不存在: ${serverId}`);
            if (!info.isRunning) return {success: true, message: '服务器已停止'};
            return new Promise(resolve => {
                info.server.close(() => {
                    info.isRunning = false;
                    info.startTime = null;
                    resolve({success: true, serverId});
                });
            });
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('httpServer:destroy')
    async destroyServer(serverId: string): Promise<any> {
        try {
            const info = this.servers.get(serverId);
            if (!info) return {success: true};
            if (info.isRunning) await this.stop(serverId);
            this.servers.delete(serverId);
            return {success: true};
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('httpServer:getStatus')
    getStatus(serverId: string): any {
        const info = this.servers.get(serverId);
        if (!info) return null;
        return {
            serverId, isRunning: info.isRunning, startTime: info.startTime,
            url: `http://${info.config.host}:${info.config.port}`,
            handlerCount: info.requestHandlers.size
        };
    }

    @IpcHandle('httpServer:list')
    list(): any[] {
        return Array.from(this.servers.entries()).map(([serverId, info]) => ({
            serverId,
            isRunning: info.isRunning,
            startTime: info.startTime,
            url: `http://${info.config.host}:${info.config.port}`,
            handlerCount: info.requestHandlers.size
        }));
    }

    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, info: ServerInfo): Promise<void> {
        const method = req.method || 'GET';
        const url = req.url || '/';
        const urlPath = url.split('?')[0];

        if (info.config.cors) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
        }

        const handlerId = info.requestHandlers.get(`${method}:${urlPath}`) ||
            info.requestHandlers.get(`*:${urlPath}`) ||
            info.requestHandlers.get(`${method}:*`);

        if (!handlerId || !info.webContents) {
            res.writeHead(404, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(JSON.stringify({error: 'Not Found'}));
            return;
        }

        try {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            await new Promise<void>(resolve => req.on('end', resolve));

            const responseData = await new Promise<any>((resolve) => {
                const timeout = setTimeout(() => {
                    this.pendingRequests.delete(requestId);
                    resolve({statusCode: 408, body: JSON.stringify({error: 'Request Timeout'})});
                }, 30000);
                this.pendingRequests.set(requestId, {resolve, timeout});
                info.webContents!.send('httpServer:handleRequest', {
                    requestId, handlerId, method, url, path: urlPath,
                    headers: req.headers, body: body || null
                });
            });

            res.writeHead(responseData.statusCode || 200, {
                'Content-Type': responseData.contentType || 'application/json; charset=utf-8',
                ...(responseData.headers || {})
            });
            res.end(responseData.body || '');
        } catch (error: any) {
            res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
            res.end(JSON.stringify({error: 'Internal Server Error', message: error.message}));
        }
    }
}
