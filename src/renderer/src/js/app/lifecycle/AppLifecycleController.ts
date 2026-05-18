import {appShellController} from '@js/features/appShell';
import {cacheManager} from '@services/CacheManager';
import type {AppUIFacade} from '@js/app/runtime/AppUIFacade';
import type {PlayMode} from '@api/types/playback';

export interface InitResult {
    status: boolean;
    error?: unknown;
}

interface AppLifecycleHost {
    isInitialized: boolean;
    initializeComponents(): void;
    setupEventListeners(): Promise<void>;
    loadInitialData(): Promise<void>;
    showApp(): void;
    schedulePluginSystemInitialization(): void;
    showFatalError(message: string): void;
    clearRuntimeData(): void;
}

interface AppLifecycleControllerOptions {
    app: AppLifecycleHost;
    playback: AppLifecyclePlayback;
    ui: AppUIFacade;
}

interface AppLifecyclePlayback {
    initializeAudio(): Promise<boolean>;
    restorePlaybackState(): Promise<void>;
    savePlaybackState(): Promise<void>;
    setPlayMode(mode: PlayMode): boolean;
    setVolume(volume: number): Promise<boolean>;
}

export class AppLifecycleController {
    private readonly app: AppLifecycleHost;
    private readonly playback: AppLifecyclePlayback;
    private readonly ui: AppUIFacade;

    constructor({app, playback, ui}: AppLifecycleControllerOptions) {
        this.app = app;
        this.playback = playback;
        this.ui = ui;
    }

    async init(): Promise<InitResult> {
        const app = this.app;

        try {
            await this.waitForDOMReady();
            await this.initializePlaybackAPI();
            app.initializeComponents();
            await app.setupEventListeners();
            await app.loadInitialData();
            await this.restoreSavedVolume();
            await this.playback.restorePlaybackState();

            app.isInitialized = true;
            app.showApp();
            app.schedulePluginSystemInitialization();
            this.scheduleUpdateCheck();

            return {status: true};
        } catch (error) {
            app.showFatalError('应用初始化失败');
            return {
                status: false,
                error
            };
        }
    }

    async cleanup(): Promise<void> {
        await this.playback.savePlaybackState();
        await this.saveCurrentVolume();
        this.app.clearRuntimeData();
    }

    private async waitForDOMReady(): Promise<void> {
        if (document.readyState !== 'loading') {
            return;
        }

        await new Promise<void>(resolve => {
            document.addEventListener('DOMContentLoaded', () => resolve(), {once: true});
        });
    }

    private async restoreSavedVolume(): Promise<void> {
        const savedVolume = cacheManager.getLocalCache('volume');
        if (typeof savedVolume !== 'number') {
            return;
        }

        await this.playback.setVolume(savedVolume);
        await this.ui.updatePlayerUI();
    }

    private async initializePlaybackAPI(): Promise<void> {
        const cachedPlayMode = cacheManager.getLocalCache('playMode') as PlayMode | null;
        if (cachedPlayMode) {
            this.playback.setPlayMode(cachedPlayMode);
        }

        const success = await this.playback.initializeAudio();
        if (!success) {
            throw new Error('Failed to initialize audio engine');
        }
    }

    private async saveCurrentVolume(): Promise<void> {
        const volume = this.ui.getPlayerVolume();
        if (volume !== null) {
            await cacheManager.setLocalCache('volume', volume);
        }
    }

    private scheduleUpdateCheck(): void {
        setTimeout(() => {
            appShellController.autoCheckForUpdates();
        }, 2000);
    }
}
