// 路径安全工具函数

const path = require('path');

/**
 * 检查路径是否在允许的根目录范围内，防止路径遍历攻击
 * @param {string} filePath - 待检查的文件路径
 * @param {string[]} allowedRoots - 允许的根目录列表
 * @returns {boolean}
 */
function isSafePath(filePath, allowedRoots) {
    if (!filePath || typeof filePath !== 'string') return false;
    if (!allowedRoots || allowedRoots.length === 0) return false;

    try {
        const resolved = path.resolve(filePath);
        return allowedRoots.some(root => {
            const resolvedRoot = path.resolve(root);
            return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
        });
    } catch {
        return false;
    }
}

/**
 * 获取系统允许的音乐文件根目录列表
 * 包括所有盘符根目录（Windows）或 / （Unix）
 * 用于宽松模式：只要不是系统敏感目录即可
 */
function getSafeMediaRoots() {
    if (process.platform === 'win32') {
        // Windows: 允许所有盘符，但排除系统目录
        const roots = [];
        for (let i = 65; i <= 90; i++) {
            roots.push(String.fromCharCode(i) + ':\\');
        }
        return roots;
    }
    return ['/'];
}

/**
 * 检查路径是否为系统敏感路径（黑名单模式）
 * @param {string} filePath
 * @returns {boolean} true 表示危险，应拒绝
 */
function isDangerousPath(filePath) {
    if (!filePath || typeof filePath !== 'string') return true;

    try {
        const resolved = path.resolve(filePath).toLowerCase();

        // 拒绝包含路径遍历序列的原始输入
        if (filePath.includes('..')) return true;

        if (process.platform === 'win32') {
            const dangerousPrefixes = [
                'c:\\windows',
                'c:\\program files',
                'c:\\program files (x86)',
                'c:\\programdata',
                'c:\\users\\default',
            ];
            return dangerousPrefixes.some(p => resolved.startsWith(p));
        } else {
            const dangerousPrefixes = ['/etc', '/sys', '/proc', '/boot', '/dev'];
            return dangerousPrefixes.some(p => resolved.startsWith(p));
        }
    } catch {
        return true;
    }
}

module.exports = {isSafePath, isDangerousPath, getSafeMediaRoots};
