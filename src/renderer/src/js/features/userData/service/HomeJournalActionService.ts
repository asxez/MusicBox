import {playbackController} from "@js/features/playback";
import {userDataService} from "./UserDataService";

export class HomeJournalActionService {
    async recordMood(mood: string): Promise<void> {
        const currentTrack = playbackController.getCurrentTrackSummary();
        await userDataService.saveMood({
            mood,
            currentTrack: currentTrack?.title || null,
            artist: currentTrack?.artist || null,
            album: currentTrack?.album || null
        } as any);
    }

    async saveMusicDiary(content: string): Promise<void> {
        const currentTrack = playbackController.getCurrentTrackSummary();
        await userDataService.saveDiary({
            content,
            currentTrack: currentTrack?.title || null,
            artist: currentTrack?.artist || null,
            album: currentTrack?.album || null
        } as any);
    }
}

export const homeJournalActionService = new HomeJournalActionService();
