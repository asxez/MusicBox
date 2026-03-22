declare module 'node-id3' {
    export interface Tags {
        title?: string;
        artist?: string;
        album?: string;
        year?: string | number;
        genre?: string;
        comment?: {
            language?: string;
            text?: string;
        };
        trackNumber?: string | number;
        partOfSet?: string | number;
        image?: string | Buffer | {
            mime: string;
            type: {
                id: number;
                name: string;
            };
            description: string;
            imageBuffer: Buffer;
        };
        unsynchronisedLyrics?: {
            language?: string;
            text?: string;
        };

        [key: string]: any;
    }

    export interface WriteOptions {
        include?: string[];
        exclude?: string[];
        noRaw?: boolean;
    }

    export function read(file: string | Buffer, options?: { noRaw?: boolean }): Tags | null;

    export function write(tags: Tags, file: string | Buffer, options?: WriteOptions): boolean | Buffer;

    export function update(tags: Tags, file: string | Buffer, options?: WriteOptions): boolean | Buffer;

    export function remove(file: string): boolean;

    export function create(tags: Tags): Buffer;
}
