// 原生音频引擎控制器

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {BaseController, Controller, IpcHandle} from '../decorators/IpcHandler';
import {WindowManager} from '../core/WindowManager';
import {NetworkFileAdapter} from '../services/network/NetworkFileAdapter';
import {assertReadableAudioFilePath} from '../utils/audioFileSecurity';

@Controller('native-audio')
export class NativeAudioController extends BaseController {
    private engine: any = null;
    private pollInterval: NodeJS.Timeout | null = null;
    private currentTempFilePath: string | null = null;

    constructor(
        private nativeAudioModule: any,
        private windowManager: WindowManager,
        private networkFileAdapter: NetworkFileAdapter
    ) {
        super();
    }

    private stopPolling(): void {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    private startPolling(): void {
        this.stopPolling();
        this.pollInterval = setInterval(() => {
            if (!this.engine) return;
            try {
                const event = this.engine.pollEvents();
                if (event) this.dispatchEvent(event);
            } catch {
            }
        }, 500);
    }

    private dispatchEvent(event: string): void {
        const win = this.windowManager.getMainWindow();
        if (!win || win.isDestroyed()) return;
        if (event === 'finished') win.webContents.send('native-audio:track-ended');
        else if (event.startsWith('error:')) win.webContents.send('native-audio:error', event.substring(6));
    }

    private async cleanupTempFile(): Promise<void> {
        if (this.currentTempFilePath) {
            const p = this.currentTempFilePath;
            this.currentTempFilePath = null;
            try {
                await fs.promises.unlink(p);
            } catch (e: any) {
                if (e.code !== 'ENOENT') console.warn(`⚠️ 清理临时文件失败: ${e.message}`);
            }
        }
    }

    @IpcHandle('native-audio:initialize')
    async initialize(shareMode?: string): Promise<any> {
        try {
            if (!this.nativeAudioModule?.NativeAudioEngine) return {success: false, error: 'NativeAudioEngine类不存在'};
            if (this.engine) {
                console.log('ℹ️ Native音频引擎已初始化，复用现有实例');
                if (shareMode === 'exclusive' || shareMode === 'shared') {
                    const currentModeResult = this.engine.getShareMode?.();
                    const currentMode = typeof currentModeResult === 'string' ? currentModeResult : currentModeResult?.mode;
                    if (currentMode && currentMode !== shareMode) {
                        const switchResult = await this.engine.switchShareMode(shareMode);
                        if (!switchResult?.success) return switchResult;
                    }
                }
                this.startPolling();
                return {success: true};
            }

            this.engine = new this.nativeAudioModule.NativeAudioEngine();
            const result = await this.engine.initialize(shareMode);
            if (!result?.success) {
                this.engine = null;
                this.stopPolling();
                return result;
            }

            this.startPolling();
            console.log('✅ Native音频引擎初始化成功');
            return result;
        } catch (error: any) {
            console.error('❌ Native音频引擎初始化失败:', error);
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('native-audio:load-track')
    async loadTrack(filePath: string): Promise<any> {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            const oldTemp = this.currentTempFilePath;
            let actualPath = filePath;
            const isNetworkPath = this.networkFileAdapter.isNetworkPath(filePath);
            assertReadableAudioFilePath(filePath, isNetworkPath);
            this.currentTempFilePath = null;

            if (isNetworkPath) {
                const ext = path.extname(filePath);
                const tempPath = path.join(os.tmpdir(), `musicbox_native_audio_${Date.now()}${ext}`);
                try {
                    const buffer = await this.networkFileAdapter.readFile(filePath);
                    await fs.promises.writeFile(tempPath, buffer);
                    actualPath = tempPath;
                    this.currentTempFilePath = tempPath;
                } catch (e: any) {
                    this.currentTempFilePath = oldTemp;
                    return {success: false, error: `下载网络文件失败: ${e.message}`};
                }
            }

            const result = await this.engine.loadTrack(actualPath);
            if (result.success !== 0 && oldTemp && oldTemp !== this.currentTempFilePath) {
                fs.promises.unlink(oldTemp).catch(() => {
                });
            }
            return result;
        } catch (error: any) {
            return {success: false, error: error.message};
        }
    }

    @IpcHandle('native-audio:play')
    async play(): Promise<any> {
        try {
            return this.engine ? await this.engine.play() : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:pause')
    async pause(): Promise<any> {
        try {
            return this.engine ? await this.engine.pause() : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:stop')
    async stop(): Promise<any> {
        try {
            return this.engine ? await this.engine.stop() : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:seek')
    async seek(position: number): Promise<any> {
        try {
            return this.engine ? await this.engine.seek(position) : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-volume')
    async setVolume(volume: number): Promise<any> {
        try {
            return this.engine ? await this.engine.setVolume(volume) : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-position')
    async getPosition(): Promise<any> {
        try {
            return this.engine ? await this.engine.getPosition() : {success: false, error: '引擎未初始化', position: 0};
        } catch (e: any) {
            return {success: false, error: e.message, position: 0};
        }
    }

    @IpcHandle('native-audio:get-render-stats')
    async getRenderStats(): Promise<any> {
        try {
            return this.engine ? await this.engine.getRenderStats() : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:reset-render-stats')
    async resetRenderStats(): Promise<any> {
        try {
            return this.engine ? await this.engine.resetRenderStats() : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-equalizer-enabled')
    async setEqEnabled(enabled: boolean): Promise<any> {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            await this.engine.setEqualizerEnabled(enabled);
            return {success: true};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:is-equalizer-enabled')
    isEqEnabled(): any {
        try {
            return this.engine ? {success: true, enabled: this.engine.isEqualizerEnabled()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-equalizer-preamp')
    async setEqPreamp(gain: number): Promise<any> {
        try {
            return this.engine ? await this.engine.setEqualizerPreamp(gain) && {success: true} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-equalizer-preamp')
    getEqPreamp(): any {
        try {
            return this.engine ? {success: true, preamp: this.engine.getEqualizerPreamp()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-equalizer-band-gain')
    async setEqBandGain(band: number, gain: number): Promise<any> {
        try {
            return this.engine ? await this.engine.setEqualizerBandGain(band, gain) && {success: true} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-equalizer-band-gain')
    getEqBandGain(band: number): any {
        try {
            return this.engine ? {success: true, gain: this.engine.getEqualizerBandGain(band)} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-equalizer-band-q')
    async setEqBandQ(band: number, q: number): Promise<any> {
        try {
            return this.engine ? await this.engine.setEqualizerBandQ(band, q) && {success: true} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-equalizer-band-q')
    getEqBandQ(band: number): any {
        try {
            return this.engine ? {success: true, q: this.engine.getEqualizerBandQ(band)} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:reset-equalizer')
    async resetEq(): Promise<any> {
        try {
            return this.engine ? await this.engine.resetEqualizer() && {success: true} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:apply-equalizer-preset')
    async applyEqPreset(preset: any): Promise<any> {
        try {
            return this.engine ? await this.engine.applyEqualizerPreset(preset) && {success: true} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-equalizer-frequency-response')
    getEqFreqResponse(): any {
        try {
            return this.engine ? {
                success: true,
                response: this.engine.getEqualizerFrequencyResponse()
            } : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-equalizer-mode')
    setEqMode(mode: string): any {
        try {
            return this.engine ? {success: this.engine.setEqualizerMode(mode)} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-equalizer-mode')
    getEqMode(): any {
        try {
            return this.engine ? {success: true, mode: this.engine.getEqualizerMode()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-is-enabled')
    parametricIsEnabled(): any {
        try {
            return this.engine ? {success: true, enabled: this.engine.parametricIsEnabled()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-set-enabled')
    parametricSetEnabled(enabled: boolean): any {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            this.engine.setEqualizerMode(enabled ? 'parametric' : 'graphic');
            this.engine.parametricSetEnabled(enabled);
            return {success: true};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-set-preamp')
    async parametricSetPreamp(gain: number): Promise<any> {
        try {
            this.engine.parametricSetPreamp(gain);
            return {success: true};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-get-preamp')
    parametricGetPreamp(): any {
        try {
            return this.engine ? {success: true, preamp: this.engine.parametricGetPreamp()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-add-band')
    parametricAddBand({frequency, gain, q, filterType}: any): any {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            const bandId = this.engine.parametricAddBand(frequency, gain, q, filterType);
            return bandId === -1 ? {success: false, error: '添加频段失败'} : {success: true, bandId};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-remove-band')
    parametricRemoveBand(bandId: number): any {
        try {
            return this.engine ? {success: this.engine.parametricRemoveBand(bandId)} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-update-band')
    parametricUpdateBand({bandId, frequency, gain, q, filterType, enabled}: any): any {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            const result = this.engine.parametricUpdateBand(
                bandId,
                frequency ?? null, gain ?? null, q ?? null, filterType ?? null, enabled ?? null
            );
            return {success: result};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-get-bands')
    parametricGetBands(): any {
        try {
            return this.engine ? {success: true, bands: this.engine.parametricGetBands()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-get-band')
    parametricGetBand(bandId: number): any {
        try {
            return this.engine ? {success: true, band: this.engine.parametricGetBand(bandId)} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-reset')
    parametricReset(): object {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            this.engine.parametricReset();
            return {success: true};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:parametric-clear-bands')
    parametricClearBands(): any {
        try {
            if (!this.engine) return {success: false, error: '引擎未初始化'};
            this.engine.parametricClearBands();
            return {success: true};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:set-share-mode')
    setShareMode(mode: string): any {
        try {
            return this.engine ? {success: this.engine.setShareMode(mode)} : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:get-share-mode')
    getShareMode(): any {
        try {
            return this.engine ? {success: true, mode: this.engine.getShareMode()} : {
                success: false,
                error: '引擎未初始化'
            };
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:switch-share-mode')
    async switchShareMode(mode: string): Promise<any> {
        try {
            return this.engine ? await this.engine.switchShareMode(mode) : {success: false, error: '引擎未初始化'};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }

    @IpcHandle('native-audio:destroy')
    async destroyEngine(): Promise<any> {
        try {
            this.stopPolling();
            if (this.engine) {
                await this.engine.destroy();
                this.engine = null;
            }
            await this.cleanupTempFile();
            return {success: true};
        } catch (e: any) {
            return {success: false, error: e.message};
        }
    }
}
