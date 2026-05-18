import type {Track} from '@api/types/track';
import type {AppComponentPort} from '../AppRuntimePorts';

type TrackPredicate = (track: Track, index: number) => boolean;

export class QueueUIFacade {
    constructor(private readonly app: AppComponentPort) {}

    hasQueue(): boolean {
        return Boolean(this.app.components.playlist);
    }

    getQueueTracks(): Track[] {
        return this.app.components.playlist?.tracks ?? [];
    }

    isQueueEmpty(): boolean {
        return this.getQueueTracks().length === 0;
    }

    getQueueCurrentIndex(): number {
        return this.app.components.playlist?.currentTrackIndex ?? -1;
    }

    syncQueueTracks(tracks: Track[], currentIndex = 0): void {
        this.app.components.playlist?.setTracks(tracks, currentIndex);
    }

    setQueueCurrentTrack(index: number): void {
        this.app.components.playlist?.setCurrentTrack(index);
    }

    addQueueTrack(track: Track): number {
        return this.app.components.playlist?.addTrack(track) ?? -1;
    }

    removeQueueTrack(index: number): void {
        this.app.components.playlist?.removeTrack(index);
    }

    renderQueue(): void {
        this.app.components.playlist?.render();
    }

    toggleQueue(): void {
        this.app.components.playlist?.toggle();
    }

    findQueueIndex(predicate: TrackPredicate): number {
        return this.getQueueTracks().findIndex(predicate);
    }

    updateQueuedTrack(filePath: string, updatedData: Partial<Track>): boolean {
        const queuedTrack = this.getQueueTracks().find((track) => track.filePath === filePath);
        if (!queuedTrack) {
            return false;
        }

        Object.assign(queuedTrack, updatedData);
        this.renderQueue();
        return true;
    }
}
