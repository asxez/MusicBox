import type {Track} from '@api/types/track';

import type {
    AppView,
    ComponentMap,
    ManagedAPIListener,
    ManagedDOMListener
} from './AppRuntimeTypes';

export class AppRuntimeState {
    isInitialized = false;
    currentView: AppView = 'home-page';
    library: Track[] = [];
    filteredLibrary: Track[] = [];
    components: ComponentMap = {} as ComponentMap;
    coversPreloadedByApp = false;
    eventListeners: ManagedDOMListener[] = [];
    apiEventListeners: ManagedAPIListener[] = [];

    clearLibraryData(): void {
        this.library = [];
        this.filteredLibrary = [];
    }
}
