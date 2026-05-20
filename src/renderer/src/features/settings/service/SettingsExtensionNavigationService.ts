type SectionNavigationHandler = (sectionName: string) => void;

class SettingsExtensionNavigationService {
    private readonly handlers = new Set<SectionNavigationHandler>();

    onNavigate(handler: SectionNavigationHandler): () => void {
        this.handlers.add(handler);
        return () => {
            this.handlers.delete(handler);
        };
    }

    navigateToSection(sectionName: string): boolean {
        if (this.handlers.size === 0) {
            return false;
        }

        this.handlers.forEach(handler => handler(sectionName));
        return true;
    }
}

export const settingsExtensionNavigationService = new SettingsExtensionNavigationService();
