export interface MediaDirectoryElements {
    lyricsFolderPath: HTMLElement | null;
    coverCacheFolderPath: HTMLElement | null;
}

type MediaDirectoryTarget = 'lyrics' | 'coverCache';

class MediaDirectorySettingsRenderer {
    updateDirectory(elements: MediaDirectoryElements, target: MediaDirectoryTarget, directory: string | null): void {
        const element = target === 'lyrics'
            ? elements.lyricsFolderPath
            : elements.coverCacheFolderPath;

        if (!element) {
            return;
        }

        if (directory) {
            element.textContent = directory;
            element.classList.add('selected');
            return;
        }

        element.textContent = '未选择';
        element.classList.remove('selected');
    }
}

export const mediaDirectorySettingsRenderer = new MediaDirectorySettingsRenderer();
