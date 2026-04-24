import {ElectronNamespaceAdapter} from './ElectronBridge';

class ElectronWindowAdapter extends ElectronNamespaceAdapter {
    constructor() {
        super('window');
    }

    setBackgroundThrottling(allowed) {
        return this.call('setBackgroundThrottling', allowed);
    }
}

export const electronWindowAdapter = new ElectronWindowAdapter();

