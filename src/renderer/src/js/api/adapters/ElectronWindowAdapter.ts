import {ElectronNamespaceAdapter} from './ElectronBridge';

class ElectronWindowAdapter extends ElectronNamespaceAdapter<'window'> {
    constructor() {
        super('window');
    }

    setBackgroundThrottling(allowed: boolean): Promise<void> {
        return this.call('setBackgroundThrottling', allowed);
    }
}

export const electronWindowAdapter = new ElectronWindowAdapter();

