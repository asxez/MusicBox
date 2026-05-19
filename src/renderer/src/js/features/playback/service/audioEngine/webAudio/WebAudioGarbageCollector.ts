async function forceWebAudioGarbageCollection(): Promise<void> {
    const maybeWindowWithGc = window as Window & {gc?: () => void};
    if (typeof maybeWindowWithGc.gc === 'function') {
        maybeWindowWithGc.gc();
    }
}

export {forceWebAudioGarbageCollection};
