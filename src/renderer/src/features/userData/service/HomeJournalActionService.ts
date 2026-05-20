import {playbackUiStateService} from "@/features/playback/service/PlaybackUiStateService";
import {userDataService} from "./UserDataService";

export class HomeJournalActionService {
    async recordMood(mood: string): Promise<void> {
        const currentTrack = playbackUiStateService.getCurrentTrackSummary();
        await userDataService.saveMood({
            mood,
            currentTrack: currentTrack?.title || null,
            artist: currentTrack?.artist || null,
            album: currentTrack?.album || null
        } as any);
    }

    async saveMusicDiary(content: string): Promise<void> {
        const currentTrack = playbackUiStateService.getCurrentTrackSummary();
        await userDataService.saveDiary({
            content,
            currentTrack: currentTrack?.title || null,
            artist: currentTrack?.artist || null,
            album: currentTrack?.album || null
        } as any);
    }
}

export const homeJournalActionService = new HomeJournalActionService();
