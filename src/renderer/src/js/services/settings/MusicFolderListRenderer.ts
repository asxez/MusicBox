interface MusicFolderListRenderOptions {
    container: HTMLElement | null | undefined;
    list: HTMLElement | null | undefined;
    folders: string[] | null | undefined;
    onRemove: (folderPath: string) => void;
}

class MusicFolderListRenderer {
    render({container, list, folders, onRemove}: MusicFolderListRenderOptions): void {
        if (!container || !list) {
            return;
        }

        if (!folders || folders.length === 0) {
            container.style.display = 'none';
            list.innerHTML = '';
            return;
        }

        container.style.display = 'flex';
        list.innerHTML = '';

        folders.forEach((folder) => {
            list.appendChild(this.createFolderItem(folder, onRemove));
        });
    }

    private createFolderItem(folder: string, onRemove: (folderPath: string) => void): HTMLElement {
        const item = document.createElement('li');
        item.className = 'folder-item';

        const pathText = document.createElement('span');
        pathText.className = 'folder-path-text';
        pathText.textContent = folder;
        pathText.title = folder;

        const removeButton = document.createElement('button');
        removeButton.className = 'folder-remove-btn';
        removeButton.textContent = '移除';
        removeButton.addEventListener('click', () => onRemove(folder));

        item.appendChild(pathText);
        item.appendChild(removeButton);
        return item;
    }
}

export const musicFolderListRenderer = new MusicFolderListRenderer();
