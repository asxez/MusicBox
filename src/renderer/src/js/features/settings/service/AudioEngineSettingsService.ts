import {playbackService} from "@js/features/playback/service/PlaybackService";
import type {AudioEngineType} from "@js/features/playback/service/AudioEngineAdapter";
import type {MusicBoxSettings, WasapiShareMode} from "@api/types/settings";

interface ExclusiveModeSettingsView {
    available: boolean;
    enabled: boolean;
    shareMode: WasapiShareMode;
}

interface AudioEngineSettingResult {
    success: boolean;
    message?: string;
    error?: string;
}

class AudioEngineSettingsService {
    getExclusiveModeSettings(settings: MusicBoxSettings, platform = navigator.platform): ExclusiveModeSettingsView {
        return {
            available: platform.toLowerCase().includes('win'),
            enabled: typeof settings.exclusiveMode === 'boolean' ? settings.exclusiveMode : false,
            shareMode: this.getWasapiShareMode(settings)
        };
    }

    async switchExclusiveMode(enabled: boolean): Promise<AudioEngineSettingResult> {
        const engineType: AudioEngineType = enabled ? 'wasapi' : 'webaudio';

        try {
            const success = await playbackService.switchAudioEngine(engineType);
            if (!success) {
                return {
                    success: false,
                    error: '音频引擎切换失败，请查看控制台日志'
                };
            }

            return {
                success: true,
                message: `已切换到${enabled ? 'WASAPI引擎' : 'WebAudio引擎'}，当前歌曲将重新加载`
            };
        } catch (error) {
            return {
                success: false,
                error: `音频引擎切换失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    async switchWasapiShareMode(mode: WasapiShareMode): Promise<AudioEngineSettingResult> {
        try {
            const success = await playbackService.switchWasapiShareMode(mode);
            if (!success) {
                return {
                    success: false,
                    error: 'WASAPI模式切换失败'
                };
            }

            return {
                success: true,
                message: `已切换到${mode === 'exclusive' ? '独占' : '共享'}模式，当前歌曲将重新加载`
            };
        } catch (error) {
            return {
                success: false,
                error: `WASAPI模式切换失败: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    getWasapiShareMode(settings: MusicBoxSettings): WasapiShareMode {
        return settings.wasapiShareMode === 'shared' ? 'shared' : 'exclusive';
    }
}

export const audioEngineSettingsService = new AudioEngineSettingsService();
