import type {PlaybackState, PlaybackStoreChange, Unsubscribe} from '@js/features/playback';
import type {Track} from '@api/types/track';

interface PlaybackQueueStateSource {
    getState(): Readonly<PlaybackState>;
    subscribe(listener: (state: Readonly<PlaybackState>, change: PlaybackStoreChange) => void): Unsubscribe;
}

interface PlaybackQueueUI {
    syncQueueTracks(tracks: Track[], currentIndex?: number): void;
    setQueueCurrentTrack(index: number): void;
}

interface PlaybackQueueSyncServiceOptions {
    playback: PlaybackQueueStateSource;
    queue: PlaybackQueueUI;
}

export class PlaybackQueueSyncService {
    private readonly playback: PlaybackQueueStateSource;
    private readonly queue: PlaybackQueueUI;
    private unsubscribe: Unsubscribe | null = null;

    constructor({playback, queue}: PlaybackQueueSyncServiceOptions) {
        this.playback = playback;
        this.queue = queue;
    }

    start(): void {
        if (this.unsubscribe) {
            return;
        }

        const state = this.playback.getState();
        this.queue.syncQueueTracks(state.playlist, state.currentIndex);

        this.unsubscribe = this.playback.subscribe((nextState, change) => {
            if (change.type === 'playlistChanged') {
                this.queue.syncQueueTracks(nextState.playlist, nextState.currentIndex);
                return;
            }

            if (change.type === 'trackIndexChanged') {
                this.queue.setQueueCurrentTrack(nextState.currentIndex);
            }
        });
    }

    dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
    }
}
