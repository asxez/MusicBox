import type {AddManagedDomListener, RemoveManagedDomListener} from "@ui/widgets/player/PlayerDomEvents";

interface PlayerCoverInteractionControllerOptions {
    trackCoverContainer: HTMLElement;
    addDomListener: AddManagedDomListener;
    removeDomListener: RemoveManagedDomListener;
    isMiniMode: () => boolean;
    onOpenLyrics: () => void;
    onToggleMiniMode: () => Promise<void> | void;
}

class PlayerCoverInteractionController {
    private readonly trackCoverContainer: HTMLElement;
    private readonly addDomListener: AddManagedDomListener;
    private readonly removeDomListener: RemoveManagedDomListener;
    private readonly isMiniMode: () => boolean;
    private readonly onOpenLyrics: () => void;
    private readonly onToggleMiniMode: () => Promise<void> | void;

    private readonly coverClickHandler: EventListener;
    private readonly coverDblClickHandler: EventListener;
    private readonly coverMouseEnterHandler: EventListener;
    private readonly coverMouseLeaveHandler: EventListener;
    private standardInteractionsEnabled = false;
    private bound = false;

    constructor(options: PlayerCoverInteractionControllerOptions) {
        this.trackCoverContainer = options.trackCoverContainer;
        this.addDomListener = options.addDomListener;
        this.removeDomListener = options.removeDomListener;
        this.isMiniMode = options.isMiniMode;
        this.onOpenLyrics = options.onOpenLyrics;
        this.onToggleMiniMode = options.onToggleMiniMode;

        this.coverClickHandler = () => {
            this.onOpenLyrics();
        };
        this.coverDblClickHandler = () => {
            if (this.isMiniMode()) {
                void this.onToggleMiniMode();
            }
        };
        this.coverMouseEnterHandler = () => {
            this.trackCoverContainer.classList.add('hover');
        };
        this.coverMouseLeaveHandler = () => {
            this.trackCoverContainer.classList.remove('hover');
        };
    }

    bind(): void {
        if (this.bound) return;

        this.enableStandardInteractions();
        this.addDomListener(this.trackCoverContainer, 'dblclick', this.coverDblClickHandler);
        this.bound = true;
    }

    enableStandardInteractions(): void {
        if (this.standardInteractionsEnabled) {
            return;
        }

        this.addDomListener(this.trackCoverContainer, 'click', this.coverClickHandler);
        this.addDomListener(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);
        this.addDomListener(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);
        this.standardInteractionsEnabled = true;
    }

    disableStandardInteractions(): void {
        if (!this.standardInteractionsEnabled) {
            return;
        }

        this.removeDomListener(this.trackCoverContainer, 'click', this.coverClickHandler);
        this.removeDomListener(this.trackCoverContainer, 'mouseenter', this.coverMouseEnterHandler);
        this.removeDomListener(this.trackCoverContainer, 'mouseleave', this.coverMouseLeaveHandler);
        this.trackCoverContainer.classList.remove('hover');
        this.standardInteractionsEnabled = false;
    }

    destroy(): void {
        this.disableStandardInteractions();
        if (this.bound) {
            this.removeDomListener(this.trackCoverContainer, 'dblclick', this.coverDblClickHandler);
            this.bound = false;
        }
    }
}

export {PlayerCoverInteractionController};
