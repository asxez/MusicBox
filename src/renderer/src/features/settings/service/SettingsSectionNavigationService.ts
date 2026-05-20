class SettingsSectionNavigationService {
    switchToSection(sectionName: string): void {
        document.querySelectorAll<HTMLElement>('.settings-nav-btn').forEach((button) => {
            if (button.dataset.section === sectionName) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });

        document.querySelectorAll<HTMLElement>('.settings-section').forEach((section) => {
            if (section.dataset.section === sectionName) {
                section.classList.add('active');
            } else {
                section.classList.remove('active');
            }
        });
    }
}

export const settingsSectionNavigationService = new SettingsSectionNavigationService();
