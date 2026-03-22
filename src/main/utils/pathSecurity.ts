/**
 * 路径安全工具函数
 * 防止路径遍历攻击和访问系统敏感目录
 */

import * as path from 'path';

/**
 * 检查路径是否在允许的根目录范围内，防止路径遍历攻击
 * @param filePath - 待检查的文件路径
 * @param allowedRoots - 允许的根目录列表
 * @returns 是否为安全路径
 */
export function isSafePath(filePath: string, allowedRoots: string[]): boolean {
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
export function getSafeMediaRoots(): string[] {
    if (process.platform === 'win32') {
        // Windows: 允许所有盘符，但排除系统目录
        const roots: string[] = [];
        for (let i = 65; i <= 90; i++) {
            roots.push(String.fromCharCode(i) + ':\\');
        }
        return roots;
    }
    return ['/'];
}

/**
 * 检查路径是否为系统敏感路径（黑名单模式）
 * @param filePath - 待检查的文件路径
 * @returns true 表示危险，应拒绝
 */
export function isDangerousPath(filePath: string): boolean {
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
