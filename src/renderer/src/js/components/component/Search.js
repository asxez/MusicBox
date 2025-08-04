/**
 * 搜索组件
 */

class Search extends Component {
    constructor() {
        super('#search-input');
        this.setupEventListeners();
    }

    setupEventListeners() {
        const debouncedSearch = debounce((query) => {
            this.performSearch(query);
        }, 200);

        this.element.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length > 0) {
                debouncedSearch(query);
            } else if (query.length === 0) {
                this.clearSearch();
            }
        });

        this.element.addEventListener('keydown', (e) => {
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
}
