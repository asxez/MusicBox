class SettingsPageVisibilityService {
    show(page: HTMLElement): void {
        page.style.display = 'block';
        this.setAppChromeVisible(false);

        requestAnimationFrame(() => {
            page.classList.add('show');
        });
    }

    hide(page: HTMLElement, isVisible: () => boolean): void {
        page.classList.remove('show');
        page.classList.add('hiding');

        setTimeout(() => {
            if (isVisible()) {
                return;
            }

            page.style.display = 'none';
            page.classList.remove('hiding');
            this.setAppChromeVisible(true);
        }, 300);
    }

    private setAppChromeVisible(visible: boolean): void {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const display = visible ? 'block' : 'none';

        if (sidebar) {
            sidebar.style.display = display;
        }

        if (mainContent) {
            mainContent.style.display = display;
        }
    }
}

export const settingsPageVisibilityService = new SettingsPageVisibilityService();
