class FileAPI {
    async openDirectory() {
        try {
            // 使用原始的openDirectory方法，返回字符串路径（用于音乐目录扫描等）
            return await window.electronAPI.openDirectory(); // 直接返回字符串路径或null
        } catch (error) {
            console.error('无法打开目录对话框:', error);
            return null;
        }
    }

    // 同openDirectory，保留向后兼容
    async openDirectoryDialog() {
        try {
            return await window.electronAPI.openDirectory();
        } catch (error) {
            console.error('无法打开目录对话框:', error);
            return null;
        }
    }

    async openFiles() {
        try {
            return await window.electronAPI.openFiles();
        } catch (error) {
            console.error('无法打开文件对话框:', error);
            return [];
        }
    }

    // 选择音乐文件夹方法（用于设置页面）
    async selectMusicFolder() {
        try {
            const result = await window.electronAPI.selectFolder();
            if (result && result.filePaths && result.filePaths.length > 0 && !result.canceled) {
                return {path: result.filePaths[0], success: true};
            }
            return {success: false};
        } catch (error) {
            console.error('选择音乐文件夹失败:', error);
            return {success: false, error: error.message};
        }
    }

    // 选择图片文件方法（用于歌单封面）
    async selectImageFile() {
        try {
            const imagePath = await window.electronAPI.openImageFile();
            if (imagePath) {
                return {path: imagePath, success: true};
            }
            return {success: false};
        } catch (error) {
            console.error('选择图像文件失败:', error);
            return {success: false, error: error.message};
        }
    }
}

let fileAPI = new FileAPI();
export {fileAPI};
