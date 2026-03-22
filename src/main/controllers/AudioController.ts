// 音频引擎状态管理 + IPC 控制器

import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import type {TrackMetadata} from '../types/global';

export interface AudioEngineState {
    isInitialized: boolean;
    currentTrack: any | null;
    isPlaying: boolean;
    volume: number;
    position: number;
    duration: number;
    playlist: any[];
    currentIndex: number;
    scannedTracks: any[];
}

const createDefaultState = (): AudioEngineState => ({
    isInitialized: false,
    currentTrack: null,
    isPlaying: false,
    volume: 1,
    position: 0,
    duration: 0,
    playlist: [],
    currentIndex: 0,
    scannedTracks: []
});

@Controller('audio')
export class AudioController extends BaseController {
    readonly state: AudioEngineState;
    private parseMetadata: (filePath: string) => Promise<TrackMetadata>;

    constructor(parseMetadata: (filePath: string) => Promise<TrackMetadata>, initialState?: AudioEngineState) {
        super();
        this.parseMetadata = parseMetadata;
        this.state = initialState ?? createDefaultState();
    }

    @IpcHandle('audio:init')
    async init(): Promise<boolean> {
        try {
            this.state.isInitialized = true;
            return true;
        } catch (error) {
            console.error('❌ 音频引擎初始化失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:loadTrack')
    async loadTrack(filePath: string): Promise<boolean> {
        try {
            if (!filePath) {
                console.warn('⚠️ loadTrack: 未提供文件路径');
                return false;
            }
            console.log(`🔄 加载音频文件: ${filePath}`);
            const metadata = await this.parseMetadata(filePath);

            this.state.currentTrack = {
                filePath,
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                duration: metadata.duration,
                bitrate: metadata.bitrate,
                sampleRate: metadata.sampleRate,
                year: metadata.year,
                genre: metadata.genre,
                track: (metadata as any).track,
                disc: (metadata as any).disc,
                cover: null,
                embeddedLyrics: metadata.embeddedLyrics
            };

            console.log(`✅ 音频文件信息已更新: ${this.state.currentTrack.title}`);
            return true;
        } catch (error) {
            console.error('❌ 加载音频文件失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:play')
    async play(): Promise<boolean> {
        try {
            this.state.isPlaying = true;
            console.log('▶️ 播放状态已更新');
            return true;
        } catch (error) {
            console.error('❌ 播放失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:pause')
    async pause(): Promise<boolean> {
        try {
            this.state.isPlaying = false;
            console.log('⏸️ 暂停状态已更新');
            return true;
        } catch (error) {
            console.error('❌ 暂停失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:stop')
    async stop(): Promise<boolean> {
        try {
            this.state.isPlaying = false;
            this.state.position = 0;
            console.log('⏹️ 停止状态已更新');
            return true;
        } catch (error) {
            console.error('❌ 停止失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:seek')
    async seek(position: number): Promise<boolean> {
        try {
            this.state.position = Math.max(0, position);
            console.log(`⏭️ 跳转到位置: ${position.toFixed(2)}s`);
            return true;
        } catch (error) {
            console.error('❌ 跳转失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:setVolume')
    async setVolume(volume: number): Promise<boolean> {
        try {
            if (isNaN(volume)) return false;
            this.state.volume = Math.max(0, Math.min(1, volume));
            console.log(`🔊 音量已设置: ${this.state.volume}`);
            return true;
        } catch (error) {
            console.error('❌ 音量设置失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:getVolume')
    async getVolume(): Promise<number> {
        return this.state.volume;
    }

    @IpcHandle('audio:getPosition')
    async getPosition(): Promise<number> {
        return this.state.position;
    }

    @IpcHandle('audio:getDuration')
    async getDuration(): Promise<number> {
        return this.state.currentTrack?.duration ?? 0;
    }

    @IpcHandle('audio:getCurrentTrack')
    async getCurrentTrack(): Promise<any> {
        return this.state.currentTrack ?? {
            filePath: '',
            title: '未选择音频文件',
            artist: '未知艺术家',
            album: '未知专辑',
            duration: 0
        };
    }

    @IpcHandle('audio:setPlaylist')
    async setPlaylist(tracks: any[]): Promise<boolean> {
        try {
            if (!tracks || !Array.isArray(tracks)) {
                console.warn('⚠️ setPlaylist: 无效的播放列表');
                return false;
            }
            this.state.playlist = tracks;
            this.state.currentIndex = 0;
            console.log(`📋 播放列表已设置: ${tracks.length}首歌曲`);
            return true;
        } catch (error) {
            console.error('❌ 设置播放列表失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:nextTrack')
    async nextTrack(): Promise<boolean> {
        try {
            if (this.state.playlist.length === 0) return false;
            this.state.currentIndex = (this.state.currentIndex + 1) % this.state.playlist.length;
            this.state.currentTrack = this.state.playlist[this.state.currentIndex];
            console.log(`⏭️ 切换到下一首: ${this.state.currentTrack?.title}`);
            return true;
        } catch (error) {
            console.error('❌ 播放下一首失败:', error);
            return false;
        }
    }

    @IpcHandle('audio:previousTrack')
    async previousTrack(): Promise<boolean> {
        try {
            if (this.state.playlist.length === 0) return false;
            this.state.currentIndex = this.state.currentIndex > 0
                ? this.state.currentIndex - 1
                : this.state.playlist.length - 1;
            this.state.currentTrack = this.state.playlist[this.state.currentIndex];
            console.log(`⏮️ 切换到上一首: ${this.state.currentTrack?.title}`);
            return true;
        } catch (error) {
            console.error('❌ 播放上一首失败:', error);
            return false;
        }
    }
}
