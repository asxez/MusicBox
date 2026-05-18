import {cacheManager} from "@js/shared/cache";
import type {Unsubscribe} from "@api/types/common";

type TrackCoverDisplayListener = (enabled: boolean) => void | Promise<void>;

class TrackCoverDisplayPreferenceService {
    private readonly listeners = new Set<TrackCoverDisplayListener>();
    private enabled = this.readEnabledFromCache();

    isEnabled(): boolean {
        return this.enabled;
    }

    setEnabled(enabled: boolean): void {
        if (this.enabled === enabled) {
            return;
        }

        this.enabled = enabled;
        this.listeners.forEach((listener) => {
            try {
                void listener(enabled);
            } catch (error) {
                console.error('❌ TrackCoverDisplayPreferenceService: 通知封面显示设置失败', error);
            }
        });
    }

    onChanged(listener: TrackCoverDisplayListener): Unsubscribe {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    refreshFromCache(): void {
        this.setEnabled(this.readEnabledFromCache());
    }

    private readEnabledFromCache(): boolean {
        const settings = cacheManager.getLocalCache<Record<string, boolean>>('musicbox-settings') || {};
        return Object.prototype.hasOwnProperty.call(settings, 'showTrackCovers') ? settings.showTrackCovers : true;
    }
}

export const trackCoverDisplayPreferenceService = new TrackCoverDisplayPreferenceService();
