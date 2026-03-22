/**
 * 允许暴露给渲染进程的函数白名单
 */

// os 模块允许的函数
export const OS_ALLOWED = [
    'platform', 'type', 'arch', 'release',
    'uptime', 'freemem', 'totalmem', 'cpus', 'loadavg', 'endianness'
] as const;

// path 模块允许的函数（纯函数，暴露给渲染端用于构造/校验 path 字符串）
export const PATH_ALLOWED = [
    'join', 'resolve', 'normalize', 'basename', 'dirname',
    'extname', 'isAbsolute', 'relative', 'parse', 'format', 'sep'
] as const;

// fs 模块允许的函数（仅只读、异步 promise API）
export const FS_ALLOWED = [
    'stat', 'lstat', 'readdir', 'readFile', 'realpath', 'access'
] as const;

// 类型导出
export type OSAllowedFunction = typeof OS_ALLOWED[number];
export type PathAllowedFunction = typeof PATH_ALLOWED[number];
export type FSAllowedFunction = typeof FS_ALLOWED[number];
