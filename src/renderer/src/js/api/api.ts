import {appEventService} from '@js/features/events/service/AppEventService';
import {playbackApiAdapter} from '@js/features/playback/service/PlaybackApiAdapter';
import {playbackUiStateService} from '@js/features/playback/service/PlaybackUiStateService';
import {MusicBoxAPI, api} from './MusicBoxAPI';

appEventService.bindEventBus({
    on: (event, handler) => api.on(event, handler),
    off: (event, handler) => api.off(event, handler),
    emit: (event, payload) => api.emit(event, payload)
});

playbackApiAdapter.bindRuntime(api);
playbackUiStateService.syncStateFromRuntime();

export {MusicBoxAPI, api};
