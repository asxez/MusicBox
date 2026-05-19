import type {Playlist, Track} from "@api/types/library";
import {libraryDataService} from "@js/features/library/service/LibraryDataService";

export interface CreatePlaylistActionResult {
    success: boolean;
    playlist?: Playlist;
    error?: string;
}

export interface RenamePlaylistActionResult {
    success: boolean;
    playlist?: Playlist;
    error?: string;
}

export interface AddToPlaylistActionResult {
    success: boolean;
    playlist?: Playlist;
    error?: string;
}

export interface AddSelectedTracksResult {
    successCount: number;
    failCount: number;
}

export class PlaylistDialogActionService {
    async getPlaylists(): Promise<Playlist[]> {
        return await libraryDataService.getPlaylists();
    }

    async getSelectableTracks(existingTrackIds?: string[]): Promise<Track[]> {
        const tracks = await libraryDataService.getTracks();
        if (!existingTrackIds) {
            return tracks;
        }

        return tracks.filter(track => !track.fileId || !existingTrackIds.includes(track.fileId));
    }

    async addTrackToPlaylist(
        playlistId: string,
        track: Track,
        playlists: Playlist[]
    ): Promise<AddToPlaylistActionResult> {
        if (!track.fileId) {
            return {success: false, error: '当前歌曲缺少文件标识，无法添加到歌单'};
        }

        const result = await libraryDataService.addToPlaylist(playlistId, track.fileId);
        return {
            success: result.success,
            playlist: playlists.find(p => p.id === playlistId),
            error: result.error
        };
    }

    async createPlaylist(name: string, description: string, trackToAdd?: Track | null): Promise<CreatePlaylistActionResult> {
        const result = await libraryDataService.createPlaylist(name, description);
        if (!result.success || !result.playlist) {
            return result;
        }

        if (trackToAdd?.fileId) {
            try {
                await libraryDataService.addToPlaylist(result.playlist.id, trackToAdd.fileId);
                console.log('✅ PlaylistDialogActionService: 歌曲已添加到新歌单');
            } catch (error) {
                console.warn('⚠️ PlaylistDialogActionService: 添加歌曲到新歌单失败', error);
            }
        }

        return result;
    }

    async renamePlaylist(playlistId: string, newName: string): Promise<RenamePlaylistActionResult> {
        return await libraryDataService.renamePlaylist(playlistId, newName);
    }

    async addSelectedTracks(playlistId: string, selectedTrackIds: string[]): Promise<AddSelectedTracksResult> {
        let successCount = 0;
        let failCount = 0;

        for (const trackId of selectedTrackIds) {
            try {
                const result = await libraryDataService.addToPlaylist(playlistId, trackId);

                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.warn('❌ 添加歌曲失败:', trackId, result.error);
                }
            } catch (error) {
                failCount++;
                console.error('❌ 添加歌曲异常:', trackId, error);
            }
        }

        console.log(`✅ PlaylistDialogActionService: 批量添加歌曲完成: 成功 ${successCount}, 失败 ${failCount}`);
        return {successCount, failCount};
    }
}

export const playlistDialogActionService = new PlaylistDialogActionService();
