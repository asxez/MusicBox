declare module 'node-smb2' {
    export interface SMB2Options {
        share: string;
        domain: string;
        username: string;
        password: string;
        port?: number;
        packetConcurrency?: number;
        autoCloseTimeout?: number;
    }

    export interface SMB2Stats {
        isDirectory(): boolean;

        isFile(): boolean;

        size: number;
        atime: Date;
        mtime: Date;
        ctime: Date;
        birthtime: Date;
    }

    export default class SMB2 {
        constructor(options: SMB2Options);

        readFile(path: string, callback: (err: Error | null, data: Buffer) => void): void;
        readFile(path: string, encoding: string, callback: (err: Error | null, data: string) => void): void;

        writeFile(path: string, data: Buffer | string, callback: (err: Error | null) => void): void;

        readdir(path: string, callback: (err: Error | null, files: string[]) => void): void;

        stat(path: string, callback: (err: Error | null, stats: SMB2Stats) => void): void;

        exists(path: string, callback: (err: Error | null, exists: boolean) => void): void;

        mkdir(path: string, callback: (err: Error | null) => void): void;

        rmdir(path: string, callback: (err: Error | null) => void): void;

        unlink(path: string, callback: (err: Error | null) => void): void;

        rename(oldPath: string, newPath: string, callback: (err: Error | null) => void): void;

        close(): void;
    }
}
