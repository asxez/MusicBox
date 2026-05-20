export type FileStatResult = {
    size: number;
    mtime: unknown;
    isFile: boolean;
    isDirectory: boolean;
};

/**
 * @deprecated Phase 5 compatibility shell. Use domain services instead.
 */
export class MediaFileSystemService {
    async readFile(filePath: string, encoding: string | null = null): Promise<string | ArrayLike<number>> {
        void filePath;
        void encoding;
        return '';
    }

    async writeFile(filePath: string, data: string, encoding: string | null = null): Promise<boolean> {
        void filePath;
        void data;
        void encoding;
        return false;
    }

    async stat(filePath: string): Promise<FileStatResult> {
        void filePath;
        return {
            size: 0,
            mtime: null,
            isFile: false,
            isDirectory: false
        };
    }
}

export const mediaFileSystemService = new MediaFileSystemService();
