import {fileGateway} from '@js/infrastructure/electron';

export type FileStatResult = {
    size: number;
    mtime: unknown;
    isFile: boolean;
    isDirectory: boolean;
};

export class MediaFileSystemService {
    async readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        return await this.wrapFileOperation(() => fileGateway.readFile(filePath, encoding), '');
    }

    async writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        return await this.wrapFileOperation(() => fileGateway.writeFile(filePath, data, encoding), false);
    }

    async stat(filePath: string): Promise<FileStatResult> {
        return await fileGateway.stat(filePath);
    }

    private async wrapFileOperation<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await operation();
        } catch (error) {
            console.error('❌ MediaFileSystemService: 文件系统操作失败', error);
            return fallback;
        }
    }
}

export const mediaFileSystemService = new MediaFileSystemService();
