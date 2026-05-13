// Lightweight file IPC used by playback and benchmark paths.

import * as fs from 'fs';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {NetworkFileAdapter} from '../services/network/NetworkFileAdapter';
import {isDangerousPath} from '../utils/pathSecurity';

@Controller('file')
export class FileController extends BaseController {
    constructor(private networkFileAdapter: NetworkFileAdapter) {
        super();
    }

    @IpcHandle('file:readAudio')
    async readAudioFile(filePath: string): Promise<any> {
        try {
            console.log(`📖 读取音频文件: ${filePath}`);

            if (this.networkFileAdapter.isNetworkPath(filePath)) {
                console.log(`🌐 读取网络音频文件: ${filePath}`);
                const buffer = await this.networkFileAdapter.readFile(filePath);
                return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
            }

            if (isDangerousPath(filePath)) {
                throw new Error(`🔒 拒绝访问危险路径: ${filePath}`);
            }

            const buffer = await fs.promises.readFile(filePath);
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        } catch (error: any) {
            console.error('❌ 读取音频文件失败:', error);
            throw error;
        }
    }
}
