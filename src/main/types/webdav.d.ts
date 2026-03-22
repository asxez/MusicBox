declare module 'webdav' {
    export interface WebDAVClientOptions {
        username?: string;
        password?: string;
        token?: string;
        headers?: Record<string, string>;
    }

    export interface FileStat {
        filename: string;
        basename: string;
        lastmod: string;
        size: number;
        type: 'file' | 'directory';
        etag: string | null;
        mime?: string;
    }

    export class WebDAVClient {
        constructor(url: string, options?: WebDAVClientOptions);

        getDirectoryContents(path: string): Promise<FileStat[]>;

        getFileContents(path: string): Promise<Buffer>;
        getFileContents(path: string, options: { format: 'text' }): Promise<string>;

        putFileContents(path: string, data: string | Buffer): Promise<boolean>;

        createDirectory(path: string): Promise<void>;

        deleteFile(path: string): Promise<void>;

        moveFile(fromPath: string, toPath: string): Promise<void>;

        copyFile(fromPath: string, toPath: string): Promise<void>;

        stat(path: string): Promise<FileStat>;

        exists(path: string): Promise<boolean>;
    }

    export function createClient(url: string, options?: WebDAVClientOptions): WebDAVClient;
}
