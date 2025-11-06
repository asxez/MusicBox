
// os
const OS_ALLOWED = [
    'platform', 'type', 'arch', 'release',
    'uptime', 'freemem', 'totalmem', 'cpus', 'loadavg', 'endianness'
];

// path (纯函数，暴露给渲染端用于构造/校验 path 字符串)
const PATH_ALLOWED = [
    'join', 'resolve', 'normalize', 'basename', 'dirname',
    'extname', 'isAbsolute', 'relative', 'parse', 'format', 'sep'
];

// fs (仅只读、异步 promise API)
const FS_ALLOWED = [
    'stat', 'lstat', 'readdir', 'readFile', 'realpath', 'access', 'readFileSync'
];


module.exports = {
    OS_ALLOWED,
    PATH_ALLOWED,
    FS_ALLOWED,
};
