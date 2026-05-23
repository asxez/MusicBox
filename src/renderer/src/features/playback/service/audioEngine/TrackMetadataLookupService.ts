import type {Track} from '@api/types/track';
import {libraryDataService} from '@/features/library/service/LibraryDataService';

export type AudioTrackMetadata = Partial<Track> & {
    cover?: unknown;
};

export class TrackMetadataLookupService {
    async getTrackMetadata(filePath: string): Promise<AudioTrackMetadata | null> {
        return await libraryDataService.getTrackMetadata(filePath) as AudioTrackMetadata | null;
    }

    async getTrackPlaybackMetadata(filePath: string): Promise<AudioTrackMetadata | null> {
        return await libraryDataService.getTrackPlaybackMetadata(filePath) as AudioTrackMetadata | null;
    }
}

export const trackMetadataLookupService = new TrackMetadataLookupService();
