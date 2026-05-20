import type {Track} from '@api/types/track';
import type {AppComponentPort} from '../AppRuntimePorts';

export class QueueUIFacade {
    constructor(private readonly app: AppComponentPort) {}

    syncQueueTracks(tracks: Track[], currentIndex = 0): void {
        this.app.components.playlist?.setTracks(tracks, currentIndex);
    }

    setQueueCurrentTrack(index: number): void {
        this.app.components.playlist?.setCurrentTrack(index);
    }

    toggleQueue(): void {
        this.app.components.playlist?.toggle();
    }
}
