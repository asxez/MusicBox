import type {Track} from "@api/types/library";
import {appNotificationService} from "@js/features/appShell/service";

export class PlaylistPlaybackActionService {
    getPlayableTracks(tracks: Track[]): Track[] | null {
        if (tracks.length === 0) {
            appNotificationService.showInfo('歌单为空，无法播放');
            return null;
        }

        return tracks;
    }

    getShuffledPlayableTracks(tracks: Track[]): Track[] | null {
        const playableTracks = this.getPlayableTracks(tracks);
        return playableTracks ? [...playableTracks].sort(() => Math.random() - 0.5) : null;
    }
}

export const playlistPlaybackActionService = new PlaylistPlaybackActionService();
