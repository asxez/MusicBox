import type {Playlist, Track} from "@api/types/library";
import {libraryDataService} from "@js/features/library/service";

export interface PlaylistCoverDetailResult {
    success?: boolean;
    coverPath?: string;
    error?: string;
}

export interface PlaylistDetailDataResult {
    success: boolean;
    playlist?: Playlist;
    tracks?: Track[];
    error?: string;
}

export class PlaylistDataService {
    async getPlaylistCover(playlistId: string): Promise<PlaylistCoverDetailResult> {
        return await libraryDataService.getPlaylistCover(playlistId);
    }

    async getPlaylistDetail(playlistId: string): Promise<PlaylistDetailDataResult> {
        return await libraryDataService.getPlaylistDetail(playlistId);
    }
}

export const playlistDataService = new PlaylistDataService();
