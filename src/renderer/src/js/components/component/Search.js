/**
 * 搜索组件
 */

class Search extends Component {
    constructor() {
        super('#search-input');
        this.debouncedSearch = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.debouncedSearch = debounce(async (query) => {
            await this.performSearch(query);
        }, 200);

        this.addEventListenerManaged(this.element, 'input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                this.debouncedSearch(query);
            } else if (query.length === 0) {
                this.clearSearch();
            }
        });
        this.addEventListenerManaged(this.element, 'keydown', (e) => {
            if (e.key === 'Escape') {
                this.element.value = '';
                this.clearSearch();
            }
        });
    }

    async performSearch(query) {
        try {
            const results = await api.searchLibrary(query);
            this.emit('searchResults', results);
        } catch (error) {
            console.error('Search failed:', error);
            showToast('搜索失败', 'error');
        }
    }

    clearSearch() {
        this.emit('searchCleared');
    }

    destroy() {
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

window.components.component.Search = Search;
