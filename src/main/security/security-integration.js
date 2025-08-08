// 安全/集成相关模块

const {app, shell} = require('electron');
const path = require('path');

let bound = false;

/**
 * 注册安全/集成相关的应用级事件与协议
 * @param {object} deps
 * @param {boolean} deps.isDev - 是否为开发环境
 */
function registerSecurityIntegration({isDev}) {
    if (bound) return; // 防止重复绑定
    bound = true;

    // Deep link 协议注册
    if (process.defaultApp) {
        if (process.argv.length >= 2) {
            app.setAsDefaultProtocolClient('musicbox', process.execPath, [path.resolve(process.argv[1])]);
        }
    } else {
        app.setAsDefaultProtocolClient('musicbox');
    }

    // 阻止创建新窗口（外链交给系统浏览器）
    app.on('web-contents-created', (event, contents) => {
        contents.on('new-window', (event, navigationUrl) => {
            event.preventDefault();
            shell.openExternal(navigationUrl);
        });
    });

    // 处理证书错误
    app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
        if (isDev) {
            // 开发环境中忽略证书错误
            event.preventDefault();
            callback(true);
        } else {
            // 生产环境中使用默认行为
            callback(false);
        }
    });
}

module.exports = {
    registerSecurityIntegration,
};
