import * as path from 'path';
import {isDangerousPath} from './pathSecurity';

const ALLOWED_AUDIO_EXTENSIONS = new Set([
    '.mp3',
    '.wav',
    '.flac',
    '.ogg',
    '.m4a',
    '.aac',
    '.wma',
    '.ape'
]);

export function assertReadableAudioFilePath(filePath: string, isNetworkPath = false): void {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('🔒 音频文件路径无效');
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
        throw new Error(`🔒 不支持的音频文件类型: ${ext || '无扩展名'}`);
    }

    if (!isNetworkPath && isDangerousPath(filePath)) {
        throw new Error(`🔒 拒绝访问危险路径: ${filePath}`);
    }
}
