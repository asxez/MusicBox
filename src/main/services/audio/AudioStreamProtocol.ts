import {protocol} from 'electron';
import * as fs from 'fs';
import {Readable} from 'stream';
import {assertReadableAudioFilePath} from '../../utils/audioFileSecurity';
import type {NetworkFileAdapter} from '../network/NetworkFileAdapter';

const AUDIO_STREAM_SCHEME = 'musicbox-audio';

let networkFileAdapter: NetworkFileAdapter | null = null;
let isRegistered = false;

function encodeAudioPath(filePath: string): string {
    return Buffer.from(filePath, 'utf8').toString('base64url');
}

function decodeAudioPath(encodedPath: string): string {
    return Buffer.from(encodedPath, 'base64url').toString('utf8');
}

function inferAudioMimeType(filePath: string): string {
    const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();

    switch (ext) {
        case '.mp3':
            return 'audio/mpeg';
        case '.flac':
            return 'audio/flac';
        case '.wav':
            return 'audio/wav';
        case '.m4a':
        case '.mp4':
        case '.aac':
            return 'audio/mp4';
        case '.ogg':
        case '.oga':
            return 'audio/ogg';
        case '.webm':
            return 'audio/webm';
        default:
            return 'application/octet-stream';
    }
}

function buildBaseHeaders(filePath: string, size: number): Headers {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type');
    headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Cache-Control', 'no-store');
    headers.set('Content-Type', inferAudioMimeType(filePath));
    headers.set('Content-Length', String(size));
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return headers;
}

function parseRangeHeader(rangeHeader: string, size: number): {start: number; end: number} | null {
    const match = /^bytes=(\d+)-(\d*)$/i.exec(rangeHeader.trim());
    if (!match) {
        return null;
    }

    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : size - 1;

    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
        return null;
    }

    return {
        start: Math.min(start, Math.max(0, size - 1)),
        end: Math.min(end, Math.max(0, size - 1))
    };
}

async function serveLocalAudio(filePath: string, request: Request): Promise<Response> {
    const stat = await fs.promises.stat(filePath);
    const rangeHeader = request.headers.get('range');
    const headers = buildBaseHeaders(filePath, stat.size);

    if (request.method === 'HEAD') {
        return new Response(null, {status: 200, headers});
    }

    if (!rangeHeader) {
        const stream = fs.createReadStream(filePath);
        return new Response(Readable.toWeb(stream), {status: 200, headers});
    }

    const range = parseRangeHeader(rangeHeader, stat.size);
    if (!range) {
        headers.set('Content-Range', `bytes */${stat.size}`);
        return new Response(null, {status: 416, headers});
    }

    const {start, end} = range;
    headers.set('Content-Length', String(end - start + 1));
    headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);

    const stream = fs.createReadStream(filePath, {start, end});
    return new Response(Readable.toWeb(stream), {status: 206, headers});
}

async function serveNetworkAudio(filePath: string, request: Request): Promise<Response> {
    if (!networkFileAdapter) {
        throw new Error('Network file adapter is not available');
    }

    const buffer = await networkFileAdapter.readFile(filePath);
    const headers = buildBaseHeaders(filePath, buffer.byteLength);
    if (request.method === 'HEAD') {
        return new Response(null, {status: 200, headers});
    }

    const rangeHeader = request.headers.get('range');
    if (!rangeHeader) {
        return new Response(buffer, {status: 200, headers});
    }

    const range = parseRangeHeader(rangeHeader, buffer.byteLength);
    if (!range) {
        headers.set('Content-Range', `bytes */${buffer.byteLength}`);
        return new Response(null, {status: 416, headers});
    }

    const {start, end} = range;
    const slice = buffer.slice(start, end + 1);
    headers.set('Content-Length', String(slice.byteLength));
    headers.set('Content-Range', `bytes ${start}-${end}/${buffer.byteLength}`);
    return new Response(slice, {status: 206, headers});
}

async function handleAudioStreamRequest(request: Request): Promise<Response> {
    if (!request.url.startsWith(`${AUDIO_STREAM_SCHEME}:`)) {
        return new Response('Unsupported audio stream request', {status: 400});
    }

    const url = new URL(request.url);
    const encodedPath = url.pathname.replace(/^\/+/, '');
    if (!encodedPath) {
        return new Response('Missing audio path', {status: 400});
    }

    const filePath = decodeAudioPath(encodedPath);
    const isNetworkPath = networkFileAdapter?.isNetworkPath(filePath) ?? false;
    assertReadableAudioFilePath(filePath, isNetworkPath);

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(null, {status: 405});
    }

    if (isNetworkPath) {
        return await serveNetworkAudio(filePath, request);
    }

    return await serveLocalAudio(filePath, request);
}

export function registerAudioStreamProtocol(adapter: NetworkFileAdapter): void {
    networkFileAdapter = adapter;

    if (isRegistered) {
        return;
    }

    protocol.handle(AUDIO_STREAM_SCHEME, async (request) => {
        try {
            return await handleAudioStreamRequest(request);
        } catch (error) {
            console.error('❌ 音频流协议处理失败:', error);
            return new Response('Failed to serve audio stream', {status: 500});
        }
    });

    isRegistered = true;
    console.log('✅ 音频流协议已注册');
}

export function createAudioStreamUrl(filePath: string, isNetworkPath: boolean): string {
    assertReadableAudioFilePath(filePath, isNetworkPath);
    return `${AUDIO_STREAM_SCHEME}://audio/${encodeAudioPath(filePath)}`;
}

export function getAudioStreamScheme(): string {
    return AUDIO_STREAM_SCHEME;
}
