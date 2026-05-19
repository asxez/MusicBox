/**
 * 封面更新管理器
 * 处理封面更新事件和缓存刷新
 */

import {libraryGateway} from "@js/infrastructure/electron";
import {localCoverManager} from "./LocalCoverManager";
import {embeddedCoverManager} from "./EmbeddedCoverManager";
import {onDOMReady} from "@utils/index.js";

export interface CoverUpdateData {
    filePath: string;
    title: string;
    artist: string;
    album?: string;
    timestamp: number;
    type?: 'cover-updated';
}

type CoverUpdateCallback = (data: CoverUpdateData) => void | Promise<void>;

class CoverUpdateManager {
    private readonly updateCallbacks: Set<CoverUpdateCallback>;
    private initialized: boolean;
    private readonly pendingUpdates: Map<string, boolean>;
    private unsubscribeCoverUpdated: (() => void) | null;

    constructor() {
        this.updateCallbacks = new Set();
        this.initialized = false;
        this.pendingUpdates = new Map();
        this.unsubscribeCoverUpdated = null;
    }

    initialize(): void {
        if (this.initialized) return;

        // 监听主进程的封面更新事件
        this.unsubscribeCoverUpdated = libraryGateway.onCoverUpdated(async (data) => {
            await this.handleCoverUpdate(data as CoverUpdateData);
        });
        this.initialized = true;
    }

    async handleCoverUpdate(data: CoverUpdateData): Promise<void> {
        const {filePath, title, artist, album, timestamp} = data;

        // 防止重复更新
        const updateKey = `${filePath}-${timestamp}`;
        if (this.pendingUpdates.has(updateKey)) {
            return;
        }
        this.pendingUpdates.set(updateKey, true);

        try {
            // 清理相关缓存
            embeddedCoverManager.clearCacheForFile(filePath);
            localCoverManager.clearCacheForTrack(title, artist, album || '');

            // 通知组件更新
            this.notifyCallbacks({
                filePath,
                title,
                artist,
                album,
                timestamp,
                type: 'cover-updated'
            });

        } catch (error) {
            console.error('处理封面更新失败:', error);
        } finally {
            // 清理防重复标记
            setTimeout(() => {
                this.pendingUpdates.delete(updateKey);
            }, 5000);
        }
    }

    onCoverUpdate(callback: CoverUpdateCallback): () => void {
        if (typeof callback !== 'function') {
            return () => {
            };
        }

        this.updateCallbacks.add(callback);
        return () => {
            this.updateCallbacks.delete(callback);
        };
    }

    notifyCallbacks(data: CoverUpdateData): void {
        this.updateCallbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('封面更新回调执行失败:', error);
            }
        });
    }

    async refreshCover(filePath: string, title: string, artist: string, album = ''): Promise<void> {
        try {
            await this.handleCoverUpdate({
                filePath,
                title,
                artist,
                album,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('手动刷新封面失败:', error);
            throw error;
        }
    }

    destroy(): void {
        this.unsubscribeCoverUpdated?.();
        this.unsubscribeCoverUpdated = null;
        this.updateCallbacks.clear();
        this.pendingUpdates.clear();
        this.initialized = false;
    }
}

const coverUpdateManager = new CoverUpdateManager();
onDOMReady(() => coverUpdateManager.initialize());
export {coverUpdateManager};
