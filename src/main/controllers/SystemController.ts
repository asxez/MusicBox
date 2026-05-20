// OS / Path / FS 控制器

import * as os from 'os';
import * as nodePath from 'path';
import * as fs from 'fs';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {OS_ALLOWED, PATH_ALLOWED, FS_ALLOWED} from '../utils/AllowedFunc';
import {isSafePath} from '../utils/pathSecurity';

@Controller('system')
export class SystemController extends BaseController {
    private readonly legacyNodeApisEnabled = process.env.MUSICBOX_ENABLE_LEGACY_NODE_APIS === '1';
    private readonly legacyFsRoots = this.parseLegacyFsRoots();

    constructor() {
        super();
    }

    @IpcHandle('os:call')
    osCall({prop, args}: { prop: string; args?: any[] }): any {
        this.assertLegacyNodeApisEnabled();
        if (!(OS_ALLOWED as readonly string[]).includes(prop)) throw new Error('not allowed');
        const val = (os as any)[prop];
        return typeof val === 'function' ? val.apply(os, args || []) : val;
    }

    @IpcHandle('path:call')
    pathCall({prop, args}: { prop: string; args?: any[] }): any {
        this.assertLegacyNodeApisEnabled();
        if (!(PATH_ALLOWED as readonly string[]).includes(prop)) throw new Error('not allowed');
        const val = (nodePath as any)[prop];
        return typeof val === 'function' ? val.apply(nodePath, args || []) : val;
    }

    @IpcHandle('fs:call')
    async fsCall({prop, args}: { prop: string; args?: any[] }): Promise<any> {
        this.assertLegacyNodeApisEnabled();
        if (!(FS_ALLOWED as readonly string[]).includes(prop)) throw new Error('not allowed');
        this.assertAllowedLegacyPath(args?.[0]);
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

    @IpcHandle('fs:stat')
    async fsStat(filePath: string): Promise<any> {
        this.assertLegacyNodeApisEnabled();
        this.assertAllowedLegacyPath(filePath);
        return fs.promises.stat(filePath);
    }

    @IpcHandle('fs:readFile')
    async readFile(filePath: string, encoding?: string): Promise<string | number[]> {
        this.assertLegacyNodeApisEnabled();
        this.assertAllowedLegacyPath(filePath);
        if (encoding) {
            const content = await fs.promises.readFile(filePath, encoding as BufferEncoding);
            return content as string;
        }
        const buffer = await fs.promises.readFile(filePath);
        return Array.from(buffer);
    }

    @IpcHandle('fs:writeFile')
    async writeFile(filePath: string, data: any, encoding = 'utf8'): Promise<boolean> {
        this.assertLegacyNodeApisEnabled();
        this.assertAllowedLegacyPath(filePath);
        try {
            await fs.promises.writeFile(filePath, data, encoding as BufferEncoding);
            return true;
        } catch {
            return false;
        }
    }

    private assertLegacyNodeApisEnabled(): void {
        if (!this.legacyNodeApisEnabled) {
            throw new Error('Legacy generic fs/path/os APIs are disabled. Use a domain IPC API.');
        }
    }

    private assertAllowedLegacyPath(filePath: unknown): void {
        if (typeof filePath !== 'string') {
            return;
        }

        if (this.legacyFsRoots.length === 0) {
            throw new Error('Legacy generic fs API is enabled, but MUSICBOX_LEGACY_FS_ROOTS is empty.');
        }

        if (!isSafePath(filePath, this.legacyFsRoots)) {
            throw new Error(`🔒 拒绝访问未授权路径: ${filePath}`);
        }
    }

    private parseLegacyFsRoots(): string[] {
        return (process.env.MUSICBOX_LEGACY_FS_ROOTS || '')
            .split(nodePath.delimiter)
            .map(root => root.trim())
            .filter(Boolean);
    }
}
