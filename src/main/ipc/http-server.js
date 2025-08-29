/**
 * HTTP服务器 IPC
 */


const httpServers = new Map();
let serverIdCounter = 0;
const pendingRequests = new Map();

/**
 * 注册HTTP服务器 IPC
 * @param {object} deps
 * @param {Electron.IpcMain} deps.ipcMain - 主进程 IPC 对象
 */
function registerHttpServerIpcHandlers({ipcMain}) {
    if (!ipcMain) throw new Error('registerHttpServerIpcHandlers: 缺少 ipcMain');

    // 设置全局响应处理器
    if (!global._httpResponseHandlerSetup) {
        ipcMain.on('httpServer:handleResponse', (event, responseData) => {
            const pendingRequest = pendingRequests.get(responseData?.requestId);
            if (pendingRequest) {
                if (pendingRequest.timeout) {
                    clearTimeout(pendingRequest.timeout);
                }
                pendingRequest.resolve(responseData);
                pendingRequests.delete(responseData?.requestId);
            }
        });
        global._httpResponseHandlerSetup = true;
    }

    // 创建HTTP服务器
    ipcMain.handle('httpServer:create', async (event, config) => {
        const http = require('http');
        try {
            const serverId = `server_${++serverIdCounter}`;
            const serverConfig = {
                port: config.port || 8899,
                host: config.host || 'localhost',
                maxConnections: config.maxConnections || 50,
                cors: config.cors !== false,
                ...config
            };

            const server = http.createServer();
            server.maxConnections = serverConfig.maxConnections;
            httpServers.set(serverId, {
                server,
                config: serverConfig,
                isRunning: false,
                startTime: null,
                requestHandlers: new Map()
            });
            return {
                success: true,
                serverId,
                config: serverConfig
            };
        } catch (error) {
            console.error('❌ 创建HTTP服务器失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 注册请求处理器
    ipcMain.handle('httpServer:registerHandler', async (event, serverId, method, path, handlerId) => {
        try {
            const serverInfo = httpServers.get(serverId);
            if (!serverInfo) {
                throw new Error(`服务器不存在: ${serverId}`);
            }

            const key = `${method.toUpperCase()}:${path}`;
            serverInfo.requestHandlers.set(key, handlerId);

            return {
                success: true,
                serverId,
                method,
                path,
                handlerId
            };

        } catch (error) {
            console.error('❌ 注册请求处理器失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 启动HTTP服务器
    ipcMain.handle('httpServer:start', async (event, serverId) => {
        try {
            const serverInfo = httpServers.get(serverId);
            if (!serverInfo) {
                throw new Error(`服务器不存在: ${serverId}`);
            }

            if (serverInfo.isRunning) {
                return {
                    success: true,
                    message: '服务器已在运行',
                    url: `http://${serverInfo.config.host}:${serverInfo.config.port}`
                };
            }

            // 设置请求处理器
            serverInfo.server.on('request', async (req, res) => {
                await handleHttpRequest(req, res, serverInfo, event.sender);
            });

            // 确保webContents引用正确
            serverInfo.webContents = event.sender;

            return new Promise((resolve) => {
                serverInfo.server.listen(serverInfo.config.port, serverInfo.config.host, () => {
                    serverInfo.isRunning = true;
                    serverInfo.startTime = Date.now();

                    const url = `http://${serverInfo.config.host}:${serverInfo.config.port}`;

                    resolve({
                        success: true,
                        url,
                        serverId
                    });
                });

                serverInfo.server.on('error', (error) => {
                    console.error(`❌ HTTP服务器错误 (${serverId}):`, error);
                    resolve({
                        success: false,
                        error: error.message
                    });
                });
            });

        } catch (error) {
            console.error('❌ 启动HTTP服务器失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 停止HTTP服务器
    ipcMain.handle('httpServer:stop', async (event, serverId) => {
        try {
            const serverInfo = httpServers.get(serverId);
            if (!serverInfo) {
                throw new Error(`服务器不存在: ${serverId}`);
            }

            if (!serverInfo.isRunning) {
                return {
                    success: true,
                    message: '服务器已停止'
                };
            }

            return new Promise((resolve) => {
                serverInfo.server.close(() => {
                    serverInfo.isRunning = false;
                    serverInfo.startTime = null;

                    resolve({
                        success: true,
                        serverId
                    });
                });
            });

        } catch (error) {
            console.error('❌ 停止HTTP服务器失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 销毁HTTP服务器
    ipcMain.handle('httpServer:destroy', async (event, serverId) => {
        try {
            const serverInfo = httpServers.get(serverId);
            if (!serverInfo) {
                return {success: true, message: '服务器不存在'};
            }

            if (serverInfo.isRunning) {
                await new Promise((resolve) => {
                    serverInfo.server.close(resolve);
                });
            }

            httpServers.delete(serverId);

            return {
                success: true,
                serverId
            };

        } catch (error) {
            console.error('❌ 销毁HTTP服务器失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 获取服务器状态
    ipcMain.handle('httpServer:getStatus', async (event, serverId) => {
        try {
            const serverInfo = httpServers.get(serverId);
            if (!serverInfo) {
                return {
                    success: false,
                    error: '服务器不存在'
                };
            }

            return {
                success: true,
                status: {
                    serverId,
                    isRunning: serverInfo.isRunning,
                    config: serverInfo.config,
                    uptime: serverInfo.startTime ? Date.now() - serverInfo.startTime : 0,
                    url: serverInfo.isRunning ?
                        `http://${serverInfo.config.host}:${serverInfo.config.port}` : null,
                    registeredHandlers: Array.from(serverInfo.requestHandlers.keys())
                }
            };

        } catch (error) {
            console.error('❌ 获取服务器状态失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 获取所有服务器列表
    ipcMain.handle('httpServer:list', async () => {
        try {
            const servers = [];
            for (const [serverId, serverInfo] of httpServers) {
                servers.push({
                    serverId,
                    isRunning: serverInfo.isRunning,
                    config: serverInfo.config,
                    uptime: serverInfo.startTime ? Date.now() - serverInfo.startTime : 0,
                    registeredHandlers: Array.from(serverInfo.requestHandlers.keys())
                });
            }

            return {
                success: true,
                servers
            };

        } catch (error) {
            console.error('❌ 获取服务器列表失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    // 注意：HTTP响应处理通过webContents.on('httpServer:handleResponse')在handleRequestWithPlugin中处理
    // 这里不需要额外的IPC处理器，因为响应是通过事件监听器处理的
}

// 处理HTTP请求
async function handleHttpRequest(req, res, serverInfo, webContents) {
    const url = require('url');
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    if (serverInfo.config.cors) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }

    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const handlerKey = `${method.toUpperCase()}:${pathname}`;
    const handlerId = serverInfo.requestHandlers.get(handlerKey);

    if (handlerId) {
        await handleRequestWithPlugin(req, res, handlerId, webContents);
    } else {
        handleNotFound(req, res);
    }
}

// 通过插件处理HTTP请求
async function handleRequestWithPlugin(req, res, handlerId, webContents) {
    try {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const requestData = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: body,
                handlerId: handlerId,
                requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };

            try {
                const responsePromise = new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        pendingRequests.delete(requestData.requestId);
                        reject(new Error('请求处理超时'));
                    }, 30000);

                    pendingRequests.set(requestData.requestId, {
                        resolve,
                        reject,
                        timeout,
                        timestamp: Date.now()
                    });
                });

                webContents.send('httpServer:handleRequest', requestData);
                const response = await responsePromise;
                if (response && response.success) {
                    if (response.headers) {
                        for (const [key, value] of Object.entries(response.headers)) {
                            res.setHeader(key, value);
                        }
                    }
                    res.writeHead(response.statusCode || 200);
                    res.end(response.body || '');
                } else {
                    handleInternalServerError(req, res, response?.error || '插件处理失败');
                }
            } catch (error) {
                console.error('❌ 插件处理请求失败:', error);
                handleInternalServerError(req, res, error.message);
            }
        });
    } catch (error) {
        console.error('❌ 处理HTTP请求失败:', error);
        handleInternalServerError(req, res, error.message);
    }
}

function handleNotFound(req, res) {
    res.writeHead(404, {
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify({
        error: 'Not Found',
        message: '请求的端点不存在'
    }));
}

function handleInternalServerError(req, res, errorMessage) {
    res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8'
    });

    res.end(JSON.stringify({
        error: 'Internal Server Error',
        message: errorMessage || '服务器内部错误'
    }));
}

module.exports = {
    registerHttpServerIpcHandlers
};
