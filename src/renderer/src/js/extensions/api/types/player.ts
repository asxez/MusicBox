import {IDisposable} from "@extensions/core";
import {PlaybackState, PlayMode} from "@extensions/api";

export type PlaybackStateType = typeof PlaybackState[keyof typeof PlaybackState];
export type PlayModeType = typeof PlayMode[keyof typeof PlayMode];

/**
 * 歌曲对象接口
 */
export interface Track {
    [key: string]: any;
}

/**
 * 播放状态对象接口
 */
export interface PlayerState {
    isPlaying: boolean;
    currentTrack: Track | null;
    position: number;
    duration: number;
    volume: number;
}

/**
 * 播放器 API 接口
 */
export interface PlayerAPI {
    /**
     * 播放歌曲
     * @returns {Promise<boolean>}
     */
    play(): Promise<boolean>;

    /**
     * 按路径播放歌曲
     * @param {string} filePath
     * @returns {Promise<void>}
     */
    playTrack(filePath: string): Promise<void>;

    /**
     * 暂停播放
     * @returns {Promise<boolean>}
     */
    pause(): Promise<boolean>;

    /**
     * 停止播放
     * @returns {Promise<boolean>}
     */
    stop(): Promise<boolean>;

    /**
     * 下一首
     * @returns {Promise<boolean>}
     */
    nextTrack(): Promise<boolean>;

    /**
     * 上一首
     * @returns {Promise<boolean>}
     */
    previousTrack(): Promise<boolean>;

    /**
     * 设置音量
     * @param {number} volume - 音量 (0-1)
     * @returns {Promise<void>}
     */
    setVolume(volume: number): Promise<void>;

    /**
     * 获取当前音量
     * @returns {number} 音量值 (0-1)
     */
    getVolume(): number;

    /**
     * 获取当前播放状态
     * @returns {PlayerState} 播放状态对象
     */
    getState(): PlayerState;

    /**
     * 获取当前歌曲
     * @returns {Track|null} 当前歌曲对象
     */
    getCurrentTrack(): Track | null;

    /**
     * 跳转到指定时间
     * @param {number} time - 时间（秒）
     * @returns {Promise<boolean>}
     */
    seek(time: number): Promise<boolean>;

    /**
     * 获取当前播放位置
     * @returns {Promise<number>} 播放位置（秒）
     */
    getPosition(): Promise<number>;

    /**
     * 获取当前歌曲时长
     * @returns {number} 时长（秒）
     */
    getDuration(): number;

    /**
     * 设置播放列表
     * @param {Track[]} tracks - 歌曲列表
     * @param {number} [startIndex=-1] - 起始播放索引
     * @returns {Promise<boolean>}
     */
    setPlaylist(tracks: Track[], startIndex?: number): Promise<boolean>;

    /**
     * 获取当前播放列表
     * @returns {Track[]} 播放列表
     */
    getPlaylist(): Track[];

    /**
     * 设置播放模式
     * @param {PlayModeType} mode - 播放模式 (sequence, shuffle, repeat-one)
     * @returns {void}
     */
    setPlayMode(mode: PlayModeType): void;

    /**
     * 获取播放模式
     * @returns {PlayModeType} 播放模式
     */
    getPlayMode(): PlayModeType;

    /**
     * 监听歌曲变化事件
     * @param {Function} callback - 回调函数
     * @returns {IDisposable} 可释放对象
     */
    onTrackChanged(callback: (track: Track) => void): IDisposable;

    /**
     * 监听播放状态变化事件
     * @param {Function} callback - 回调函数
     * @returns {IDisposable} 可释放对象
     */
    onPlaybackStateChanged(callback: (state: PlaybackStateType) => void): IDisposable;
}
