// OS / Path / FS 控制器

import * as os from 'os';
import * as nodePath from 'path';
import * as fs from 'fs';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {OS_ALLOWED, PATH_ALLOWED, FS_ALLOWED} from '../utils/AllowedFunc';
import {isDangerousPath} from '../utils/pathSecurity';

@Controller('system')
export class SystemController extends BaseController {
    constructor() {
        super();
    }

    @IpcHandle('os:call')
    osCall({prop, args}: { prop: string; args?: any[] }): any {
        if (!(OS_ALLOWED as readonly string[]).includes(prop)) throw new Error('not allowed');
        const val = (os as any)[prop];
        return typeof val === 'function' ? val.apply(os, args || []) : val;
    }

    @IpcHandle('path:call')
    pathCall({prop, args}: { prop: string; args?: any[] }): any {
        if (!(PATH_ALLOWED as readonly string[]).includes(prop)) throw new Error('not allowed');
        const val = (nodePath as any)[prop];
        return typeof val === 'function' ? val.apply(nodePath, args || []) : val;
    }

    @IpcHandle('fs:call')
    async fsCall({prop, args}: { prop: string; args?: any[] }): Promise<any> {
        if (!(FS_ALLOWED as readonly string[]).includes(prop)) throw new Error('not allowed');
        if (args && args[0] && typeof args[0] === 'string' && isDangerousPath(args[0])) {
            throw new Error(`🔒 拒绝访问危险路径: ${args[0]}`);
        }
        const fsPromises = fs.promises;
        switch (prop) {
            case 'readdir':
                return fsPromises.readdir(args![0]);
            case 'access':
                await fsPromises.access(args![0]);
                return true;
            case 'stat':
                return fsPromises.stat(args![0]);
            case 'lstat':
                return fsPromises.lstat(args![0]);
            case 'readFile':
                return fsPromises.readFile(args![0], args![1]);
            case 'realpath':
                return fsPromises.realpath(args![0]);
            default: {
                const val = (fs as any)[prop];
                return typeof val === 'function' ? val.apply(fs, args || []) : val;
            }
        }
    }

    @IpcHandle('fs:readFile')
    async readFile(filePath: string, encoding?: string): Promise<string | number[]> {
        if (isDangerousPath(filePath)) throw new Error(`🔒 拒绝访问危险路径: ${filePath}`);
        if (encoding) {
            const content = await fs.promises.readFile(filePath, encoding as BufferEncoding);
            return content as string;
        }
        const buffer = await fs.promises.readFile(filePath);
        return Array.from(buffer);
    }

    @IpcHandle('fs:writeFile')
    async writeFile(filePath: string, data: any, encoding = 'utf8'): Promise<boolean> {
        if (isDangerousPath(filePath)) throw new Error(`🔒 拒绝访问危险路径: ${filePath}`);
        try {
            await fs.promises.writeFile(filePath, data, encoding as BufferEncoding);
            return true;
        } catch {
            return false;
        }
    }
}
