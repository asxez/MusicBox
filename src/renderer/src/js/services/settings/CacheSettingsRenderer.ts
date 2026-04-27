export interface CacheSettingsElements {
    viewCacheStatsButton: HTMLButtonElement | null;
    validateCacheButton: HTMLButtonElement | null;
    clearCacheButton: HTMLButtonElement | null;
    cacheStatsDescription: HTMLElement | null;
}

class CacheSettingsRenderer {
    setStatisticsLoading(elements: CacheSettingsElements, loading: boolean): void {
        this.setButtonState(elements.viewCacheStatsButton, loading, '获取中...', '查看统计');
    }

    setValidationLoading(elements: CacheSettingsElements, loading: boolean): void {
        this.setButtonState(elements.validateCacheButton, loading, '验证中...', '验证缓存');
    }

    setClearLoading(elements: CacheSettingsElements, loading: boolean): void {
        this.setButtonState(elements.clearCacheButton, loading, '清空中...', '清空缓存');
    }

    updateDescription(elements: CacheSettingsElements, description: string): void {
        if (elements.cacheStatsDescription) {
            elements.cacheStatsDescription.textContent = description;
        }
    }

    private setButtonState(
        button: HTMLButtonElement | null,
        disabled: boolean,
        loadingText: string,
        idleText: string
    ): void {
        if (!button) {
            return;
        }

        button.disabled = disabled;
        button.textContent = disabled ? loadingText : idleText;
    }
}

export const cacheSettingsRenderer = new CacheSettingsRenderer();
