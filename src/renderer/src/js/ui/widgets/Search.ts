/**
 * 搜索组件
 */

import {debounce, showToast} from "@utils/index.js";
import {Component} from "@ui/base/Component";
import {libraryDataService} from "@js/features/library/service/LibraryDataService";

type DebouncedSearch = ((query: string) => void) & {
    cancel?: () => void;
};

class Search extends Component {
    private debouncedSearch: DebouncedSearch | null;
    declare element: HTMLInputElement | null;

    constructor() {
        super('#search-input');
        this.debouncedSearch = null;
        this.setupEventListeners();
    }

    setupEventListeners(): void {
        this.debouncedSearch = debounce(async (query) => {
            await this.performSearch(query);
        }, 200) as DebouncedSearch;

        if (!this.element || !this.debouncedSearch) {
            return;
        }

        this.addEventListenerManaged(this.element, 'input', (e: Event) => {
            const target = e.target as HTMLInputElement;
            const query = target.value.trim();
            if (query.length > 0) {
                this.debouncedSearch?.(query);
            } else if (query.length === 0) {
                this.clearSearch();
            }
        });
        this.addEventListenerManaged(this.element, 'keydown', (e: Event) => {
            const event = e as KeyboardEvent;
            if (event.key === 'Escape' && this.element) {
                this.element.value = '';
                this.clearSearch();
            }
        });
    }

    async performSearch(query: string): Promise<void> {
        try {
            const results = await libraryDataService.searchLibrary(query);
            this.emit('searchResults', results);
        } catch (error) {
            console.error('Search failed:', error);
            showToast('搜索失败', 'error');
        }
    }

    clearSearch(): void {
        this.emit('searchCleared');
    }

    focusInput(): void {
        this.element?.focus();
    }

    destroy(): void {
        // 清理防抖函数
        if (this.debouncedSearch && typeof this.debouncedSearch.cancel === 'function') {
            this.debouncedSearch.cancel();
        }
        this.debouncedSearch = null;

        // 清空搜索框
        if (this.element && !this.isDestroyed) {
            this.element.value = '';
        }

        super.destroy();
    }
}

export { Search };
