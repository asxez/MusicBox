import {cacheManager} from "@services/CacheManager";
import type {MusicBoxSettings} from "@api/types/settings";

export type SettingValue = string | number | boolean | object | null | undefined;

class SettingsStore {
    private readonly cacheKey = 'musicbox-settings';

    load(): MusicBoxSettings {
        return cacheManager.getLocalCache<MusicBoxSettings>(this.cacheKey) || {};
    }

    save(settings: MusicBoxSettings): void {
        cacheManager.setLocalCache(this.cacheKey, settings);
    }

    update(settings: MusicBoxSettings, key: string, value: SettingValue): MusicBoxSettings {
        const nextSettings = {
            ...settings,
            [key]: value
        };
        this.save(nextSettings);
        return nextSettings;
    }

    get<T = unknown>(settings: MusicBoxSettings, key: string, defaultValue: T | null = null): T | null {
        return (settings[key] !== undefined ? settings[key] : defaultValue) as T | null;
    }
}

export const settingsStore = new SettingsStore();
