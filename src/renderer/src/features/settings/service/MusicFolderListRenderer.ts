interface MusicFolderListRenderOptions {
    container: HTMLElement | null | undefined;
    list: HTMLElement | null | undefined;
    folders: string[] | null | undefined;
}

class MusicFolderListRenderer {
    render({container, list, folders}: MusicFolderListRenderOptions): void {
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
            list.appendChild(this.createFolderItem(folder));
        });
    }

    resolveRemoveFolder(target: EventTarget | null): string | null {
        const button = target instanceof Element ? target.closest<HTMLButtonElement>('.folder-remove-btn') : null;
        return button?.dataset.folderPath || null;
    }

    private createFolderItem(folder: string): HTMLElement {
        const item = document.createElement('li');
        item.className = 'folder-item';

        const pathText = document.createElement('span');
        pathText.className = 'folder-path-text';
        pathText.textContent = folder;
        pathText.title = folder;

        const removeButton = document.createElement('button');
        removeButton.className = 'folder-remove-btn';
        removeButton.textContent = '移除';
        removeButton.dataset.folderPath = folder;

        item.appendChild(pathText);
        item.appendChild(removeButton);
        return item;
    }
}

export const musicFolderListRenderer = new MusicFolderListRenderer();
