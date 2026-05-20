/**
 * 音乐轨道接口
 */
export interface Track {
    fileId?: string;
    id?: string;
    title?: string;
    artist?: string;
    album?: string;
    cover?: string | null;
    duration?: number;
    path?: string;

    [key: string]: any;
}

/**
 * 专辑接口
 */
export interface Album {
    name: string;
    artist: string;
    cover: string | null;
    tracks: Track[];
}

/**
 * 艺术家接口
 */
export interface Artist {
    name: string;
    tracks: Track[];
}

/**
 * 播放列表接口
 */
export interface Playlist {
    id: string;
    name: string;
    tracks: Track[];
    createdAt: number;
    updatedAt: number;
}

/**
 * 音乐库 API 接口
 */
export interface LibraryAPI {
    /**
     * 获取所有歌曲
     * @returns 歌曲列表
     */
    getAllTracks(): Track[];

    /**
     * 根据 ID 获取歌曲
     * @param trackId - 歌曲 ID
     * @returns 歌曲对象
     */
    getTrackById(trackId: string): Track | null;

    /**
     * 搜索歌曲
     * @param query - 搜索关键词
     * @returns 搜索结果
     */
    searchTracks(query: string): Promise<Track[]>;

    /**
     * 添加歌曲到库
     * @param track - 歌曲对象
     * @returns 是否成功
     */
    addTrack(track: Track): Promise<boolean>;

    /**
     * 从库中移除歌曲
     * @param track - 歌曲
     * @param index - 歌曲索引
     * @returns 是否成功
     */
    removeTrack(track: string, index: number): Promise<void>;

    /**
     * 更新歌曲信息
     * @param trackId - 歌曲 ID
     * @param updates - 更新的字段
     * @returns 是否成功
     */
    updateTrack(trackId: string, updates: Partial<Track>): Promise<boolean>;

    /**
     * 获取所有专辑
     * @returns 专辑列表
     */
    getAlbums(): Album[];

    /**
     * 根据名称获取专辑
     * @param albumName - 专辑名称
     * @returns 专辑对象
     */
    getAlbumByName(albumName: string): Album | null;

    /**
     * 获取所有艺术家
     * @returns 艺术家列表
     */
    getArtists(): Artist[];

    /**
     * 根据名称获取艺术家
     * @param artistName - 艺术家名称
     * @returns 艺术家对象
     */
    getArtistByName(artistName: string): Artist | null;

    /**
     * 获取所有播放列表
     * @returns 播放列表
     */
    getPlaylists(): Playlist[];

    /**
     * 根据 ID 获取播放列表
     * @param playlistId - 播放列表 ID
     * @returns 播放列表对象
     */
    getPlaylistById(playlistId: string): Playlist | null;

    /**
     * 创建播放列表
     * @param name - 播放列表名称
     * @param tracks - 初始歌曲列表
     * @returns 创建的播放列表对象
     */
    createPlaylist(name: string, tracks?: Track[]): Promise<Playlist>;

    /**
     * 更新播放列表
     * @param playlistId - 播放列表 ID
     * @param updates - 更新的字段
     * @returns 是否成功
     */
    updatePlaylist(playlistId: string, updates: Partial<Playlist>): Promise<boolean>;

    /**
     * 删除播放列表
     * @param playlistId - 播放列表 ID
     * @returns 是否成功
     */
    deletePlaylist(playlistId: string): Promise<boolean>;
}
