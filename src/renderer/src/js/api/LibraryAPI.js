class LibraryAPI {
    /**
     * 获取所有音乐
     * @param {Object} options - 查询选项
     * @returns {Promise<Array>} - 音乐列表
     */
    async getTracks(options = {}) {
        try {
            return await window.electronAPI.library.getTracks(options);
        } catch (error) {
            console.error('获取音乐失败:', error);
            return [];
        }
    }

    /**
     * 获取所有专辑
     * @returns {Promise<Array>} - 专辑列表
     */
    async getAlbums() {
        try {
            return await window.electronAPI.library.getAlbums();
        } catch (error) {
            console.error('获取专辑失败:', error);
            return [];
        }
    }

    /**
     * 获取所有艺术家
     * @returns {Promise<Array>} - 艺术家列表
     */
    async getArtists() {
        try {
            return await window.electronAPI.library.getArtists();
        } catch (error) {
            console.error('获取艺术家失败:', error);
            return [];
        }
    }

    /**
     * 搜索音乐库
     * @param {string} query - 搜索关键词
     * @returns {Promise<Array>} - 搜索结果
     */
    async searchLibrary(query) {
        try {
            return await window.electronAPI.library.search(query);
        } catch (error) {
            console.error('搜索音乐库失败:', error);
            return [];
        }
    }

    /**
     * 获取音乐元数据
     * @param {string} filePath - 文件路径
     * @returns {Promise<Object>} - 元数据
     */
    async getTrackMetadata(filePath) {
        try {
            return await window.electronAPI.library.getTrackMetadata(filePath);
        } catch (error) {
            console.error('获取音乐元数据失败:', error);
            return null;
        }
    }

    /**
     * 获取缓存统计信息
     * @returns {Promise<Object>} - 统计信息
     */
    async getCacheStatistics() {
        try {
            const stats = await window.electronAPI.library.getCacheStatistics();
            if (stats) {
                return stats;
            }
            return null;
        } catch (error) {
            console.error('❌ 获取缓存统计失败:', error);
            return null;
        }
    }

    // 检查是否有缓存的音乐库
    async hasCachedLibrary() {
        try {
            const stats = await this.getCacheStatistics();
            return stats && stats.totalTracks > 0;
        } catch (error) {
            console.error('❌ 检查缓存状态失败:', error);
            return false;
        }
    }
}

let libraryAPI = new LibraryAPI();
export {libraryAPI};
