import {showToast} from '@utils/index.js';
import {api} from "@api/api";
import {fileAPI, libraryAPI} from "@js/api";
import type {RendererAppContext} from '@core/types/app';

interface FileImportControllerOptions {
    app: RendererAppContext;
}

interface LocalAudioFile extends File {
    path: string;
}

export class FileImportController {
    private readonly app: RendererAppContext;

    constructor({app}: FileImportControllerOptions) {
        this.app = app;
    }

    async scanMusicFolder(): Promise<void> {
        try {
            const folderPath = await fileAPI.openDirectory();
            if (folderPath) {
                this.app.showScanProgress();
                const success = await api.scanDirectory(folderPath);
                if (success) {
                    showToast('音乐目录扫描成功', 'success');
                } else {
                    showToast('音乐目录扫描失败', 'error');
                }
            }
        } catch (error) {
            showToast('音乐目录扫描失败', 'error');
        }
    }

    async addMusicFiles(): Promise<void> {
        try {
            const filePaths = await fileAPI.openFiles();
            if (filePaths.length > 0) {
                let successCount = 0;
                for (const filePath of filePaths) {
                    const metadata = await libraryAPI.getTrackMetadata(filePath);
                    if (metadata) {
                        const result = await api.addTrackToLibrary(metadata);
                        if (result && result.success) {
                            successCount++;
                            console.log('🎉 [App] 文件添加成功:', metadata.title);
                        }
                    }
                }

                if (successCount > 0) {
                    showToast(`成功添加 ${successCount} 首音乐`, 'success');
                } else {
                    showToast('添加音乐失败', 'error');
                }
            }
        } catch (error) {
            showToast('添加音乐失败', 'error');
        }
    }

    setupFileLoading(): void {
        this.app.addManagedEventListener(document, 'dragover', (event) => {
            const e = event as DragEvent;
            e.preventDefault();
            if (e.dataTransfer) {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        this.app.addManagedEventListener(document, 'drop', async (event) => {
            const e = event as DragEvent;
            e.preventDefault();
            await this.handleFileDrop(e);
        });

        this.addFileMenuItems();
    }

    async handleFileDrop(e: DragEvent): Promise<void> {
        const files = Array.from(e.dataTransfer?.files || []) as LocalAudioFile[];
        const audioFiles = files.filter(file =>
            file.type.startsWith('audio/') ||
            /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)
        );

        if (audioFiles.length > 0) {
            if (audioFiles.length === 1) {
                const filePath = audioFiles[0].path;
                if (filePath) {
                    await this.loadAndPlayFile(filePath);
                }
            } else {
                await this.addFilesToPlaylist(audioFiles);
            }
        }
    }

    async openDirectoryDialog(): Promise<void> {
        try {
            const directory = await fileAPI.openDirectoryDialog();
            if (directory) {
                await this.scanDirectory(directory);
            }
        } catch (error) {
            this.app.showError('无法打开目录选择框');
        }
    }

    async loadAndPlayFile(filePath: string): Promise<void> {
        try {
            const success = await api.loadTrack(filePath);
            if (success) {
                await api.play();
                this.app.showSuccess(`正常播放: ${filePath.split(/[/\\]/).pop()}`);
            } else {
                this.app.showError(`无法加载文件: ${filePath}`);
            }
        } catch (error) {
            this.app.showError('无法加载音乐文件');
        }
    }

    async addFilesToPlaylist(files: Array<LocalAudioFile | string>): Promise<void> {
        try {
            if (files.length > 0) {
                const firstFile = files[0];
                const filePath = typeof firstFile === 'string' ? firstFile : firstFile.path;
                if (filePath) {
                    await this.loadAndPlayFile(filePath);
                }
            }
            this.app.showSuccess(`Added ${files.length} files to playlist`);
        } catch (error) {
            console.error('Failed to add files to playlist:', error);
            this.app.showError('Failed to add files to playlist');
        }
    }

    async scanDirectory(directoryPath: string): Promise<void> {
        try {
            this.app.showInfo('扫描音乐文件...');
            const success = await api.scanDirectory(directoryPath);
            if (success) {
                this.app.showSuccess('音乐目录扫描完成');
            } else {
                this.app.showError('扫描失败');
            }
        } catch (error) {
            console.error('扫描失败：', error);
            this.app.showError('扫描失败');
        }
    }

    addFileMenuItems(): void {
        const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
        if (searchInput) {
            searchInput.placeholder = '搜索... (Ctrl+O 添加音乐, Ctrl+Shift+O 添加音乐目录)';
        }
    }
}
