import {showToast} from '@utils';
import {api} from "@api/api";
import {fileAPI, libraryAPI} from "@js/api";

export class FileImportController {
    constructor({app}) {
        this.app = app;
    }

    async scanMusicFolder() {
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

    async addMusicFiles() {
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

    setupFileLoading() {
        this.app.addManagedEventListener(document, 'dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        this.app.addManagedEventListener(document, 'drop', async (e) => {
            e.preventDefault();
            await this.handleFileDrop(e);
        });

        this.addFileMenuItems();
    }

    async handleFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        const audioFiles = files.filter(file =>
            file.type.startsWith('audio/') ||
            /\.(mp3|wav|flac|ogg|m4a|aac)$/i.test(file.name)
        );

        if (audioFiles.length > 0) {
            if (audioFiles.length === 1) {
                await this.loadAndPlayFile(audioFiles[0].path);
            } else {
                await this.addFilesToPlaylist(audioFiles);
            }
        }
    }

    async openDirectoryDialog() {
        try {
            const directory = await fileAPI.openDirectoryDialog();
            if (directory) {
                await this.scanDirectory(directory);
            }
        } catch (error) {
            this.app.showError('无法打开目录选择框');
        }
    }

    async loadAndPlayFile(filePath) {
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

    async addFilesToPlaylist(files) {
        try {
            if (files.length > 0) {
                await this.loadAndPlayFile(files[0].path || files[0]);
            }
            this.app.showSuccess(`Added ${files.length} files to playlist`);
        } catch (error) {
            console.error('Failed to add files to playlist:', error);
            this.app.showError('Failed to add files to playlist');
        }
    }

    async scanDirectory(directoryPath) {
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

    addFileMenuItems() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.placeholder = '搜索... (Ctrl+O 添加音乐, Ctrl+Shift+O 添加音乐目录)';
        }
    }
}
