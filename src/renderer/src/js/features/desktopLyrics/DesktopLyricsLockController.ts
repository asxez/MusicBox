import {desktopLyricsWindowService} from './service';
import type {DesktopLyricsElements} from './DesktopLyricsTypes';

type DesktopLyricsWindowService = typeof desktopLyricsWindowService;

export class DesktopLyricsLockController {
    private isLocked = false;

    constructor(
        private readonly elements: Pick<DesktopLyricsElements, 'container' | 'controlsBar' | 'lockBtn' | 'lockIcon' | 'unlockIcon'>,
        private readonly windowService: DesktopLyricsWindowService = desktopLyricsWindowService
    ) {
    }

    get locked(): boolean {
        return this.isLocked;
    }

    bindControlHover(): void {
        this.elements.controlsBar.addEventListener('mouseenter', () => {
            void this.handleControlMouseEnter();
        });

        this.elements.controlsBar.addEventListener('mouseleave', () => {
            void this.handleControlMouseLeave();
        });
    }

    async toggle(): Promise<void> {
        this.isLocked = !this.isLocked;
        await this.applyLockState();
    }

    forceUnlocked(): void {
        this.isLocked = false;
        this.updateLockPresentation();
    }

    async applyMousePassthrough(): Promise<void> {
        if (this.isLocked) {
            await this.windowService.setIgnoreMouseEvents(true, {forward: true});
            return;
        }

        await this.windowService.setIgnoreMouseEvents(false);
    }

    private async handleControlMouseEnter(): Promise<void> {
        if (this.isLocked) {
            await this.windowService.setIgnoreMouseEvents(false);
        }
    }

    private async handleControlMouseLeave(): Promise<void> {
        if (this.isLocked) {
            await this.windowService.setIgnoreMouseEvents(true, {forward: true});
        }
    }

    private async applyLockState(): Promise<void> {
        this.updateLockPresentation();
        await this.applyMousePassthrough();
    }

    private updateLockPresentation(): void {
        this.elements.container.classList.toggle('locked', this.isLocked);
        this.elements.lockBtn.classList.toggle('locked', this.isLocked);
        this.elements.lockBtn.title = this.isLocked ? '解锁' : '锁定';
        this.elements.lockIcon.style.display = this.isLocked ? 'none' : 'block';
        this.elements.unlockIcon.style.display = this.isLocked ? 'block' : 'none';
    }
}
