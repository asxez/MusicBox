import {appEventService} from '@js/features/events/service/AppEventService';
import {playbackController} from '@js/features/playback/PlaybackController';
import {playbackApiAdapter} from '@js/features/playback/service/PlaybackApiAdapter';
import {MusicBoxAPI, api} from './MusicBoxAPI';

appEventService.bindEventBus({
    on: (event, handler) => api.on(event, handler),
    off: (event, handler) => api.off(event, handler),
    emit: (event, payload) => api.emit(event, payload)
});

playbackApiAdapter.bindRuntime(api);
playbackController.syncStateFromRuntime();

export {MusicBoxAPI, api};
