class WebAudioObjectUrlStore {
    private readonly urls: Set<string>;

    constructor() {
        this.urls = new Set();
    }

    add(url: string | null | undefined): string | null {
        if (!url || typeof url !== 'string') {
            return null;
        }

        this.urls.add(url);
        return url;
    }

    cleanup(): void {
        for (const url of this.urls) {
            try {
                URL.revokeObjectURL(url);
            } catch (error) {
                console.warn('⚠️ 清理封面URL失败:', error);
            }
        }
        this.urls.clear();
    }
}

export {WebAudioObjectUrlStore};
export default WebAudioObjectUrlStore;
