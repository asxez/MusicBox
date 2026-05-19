import type {Track} from "@api/types/library";
import {coverLookupService} from "@js/features/mediaAssets/service/CoverLookupService";
import {userDataService} from "@js/features/userData/service";
import type {DiaryData, MoodData} from "@api/types/userdata";
import {libraryDataService} from "./LibraryDataService";

export interface LibraryArtistInfo {
    name: string;
    tracks: Track[];
    albums: Set<string>;
    totalDuration: number;
    cover: string | null;
}

export interface LibraryAlbumItem {
    key: string;
    name: string;
    artist: string;
    year: string | number | null;
    cover: string | null;
    tracks: Track[];
    totalDuration: number;
    album?: string;
}

export interface CoverLookupResult {
    success?: boolean;
    imageUrl?: string;
    error?: string;
}

export interface StatisticsPageData {
    tracks: Track[];
    moodHistory: MoodData[];
    diaryHistory: DiaryData[];
}

export class LibraryPageDataService {
    async getTracks(): Promise<Track[]> {
        return await libraryDataService.getTracks();
    }

    async getHomeTracks(): Promise<Track[]> {
        return await this.getTracks();
    }

    async getArtists(): Promise<{tracks: Track[]; artists: LibraryArtistInfo[]}> {
        const tracks = await this.getTracks();
        return {
            tracks,
            artists: this.buildArtists(tracks)
        };
    }

    async getAlbums(sortBy: 'name' | 'artist' | 'tracks' | 'year' = 'name'): Promise<{tracks: Track[]; albums: LibraryAlbumItem[]}> {
        const tracks = await this.getTracks();
        const albums = this.buildAlbums(tracks);
        this.sortAlbums(albums, sortBy);
        return {tracks, albums};
    }

    async getStatisticsPageData(): Promise<StatisticsPageData> {
        const [tracks, moodHistory, diaryHistory] = await Promise.all([
            this.getTracks(),
            userDataService.getMoodHistory(),
            userDataService.getDiaryHistory()
        ]);

        return {tracks, moodHistory, diaryHistory};
    }

    async findArtistCover(artistName: string): Promise<CoverLookupResult> {
        return await coverLookupService.getCover('', artistName.trim(), '', null, false) as CoverLookupResult;
    }

    async findAlbumCover(artistName: string, albumName: string): Promise<CoverLookupResult> {
        return await coverLookupService.getCover('', artistName.trim(), albumName.trim(), null, false) as CoverLookupResult;
    }

    buildArtists(tracks: Track[]): LibraryArtistInfo[] {
        const artistMap = new Map<string, LibraryArtistInfo>();
        tracks.forEach((track) => {
            const artistName = track.artist || '未知艺术家';

            if (!artistMap.has(artistName)) {
                artistMap.set(artistName, {
                    name: artistName,
                    tracks: [],
                    albums: new Set(),
                    totalDuration: 0,
                    cover: null
                });
            }

            const artist = artistMap.get(artistName)!;
            artist.tracks.push(track);
            artist.totalDuration += track.duration || 0;

            if (track.album) {
                artist.albums.add(track.album);
            }

            if (!artist.cover && track.cover) {
                artist.cover = track.cover;
            }
        });

        return Array.from(artistMap.values())
            .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
    }

    buildAlbums(tracks: Track[]): LibraryAlbumItem[] {
        const map = new Map<string, LibraryAlbumItem>();
        tracks.forEach(track => {
            const albumName = track.album || '未知专辑';
            const albumArtist = track.albumArtist || track.albumartist || track.artist || '未知艺术家';
            const key = `${albumName}:::${albumArtist}`;
            if (!map.has(key)) {
                map.set(key, {
                    key,
                    name: albumName,
                    artist: albumArtist,
                    year: track.year || null,
                    cover: track.cover || null,
                    tracks: [],
                    totalDuration: 0
                });
            }

            const album = map.get(key)!;
            album.tracks.push(track);
            album.totalDuration += track.duration || 0;
            if (!album.cover && track.cover) album.cover = track.cover;
            if (!album.year && track.year) album.year = track.year;
        });

        return Array.from(map.values());
    }

    sortAlbums(albums: LibraryAlbumItem[], sortBy: 'name' | 'artist' | 'tracks' | 'year'): void {
        switch (sortBy) {
            case 'name':
                albums.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
                break;
            case 'artist':
                albums.sort((a, b) => a.artist.localeCompare(b.artist, 'zh-CN'));
                break;
            case 'tracks':
                albums.sort((a, b) => b.tracks.length - a.tracks.length);
                break;
            case 'year':
                albums.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
                break;
            default:
                break;
        }
    }
}

export const libraryPageDataService = new LibraryPageDataService();
