import {appEventService} from './service';
import type {EventHandler, KnownEventName, Unsubscribe} from './service';

class AppEventController {
    on<K extends KnownEventName>(event: K, handler: EventHandler<K>): Unsubscribe {
        return appEventService.on(event, handler);
    }

    off<K extends KnownEventName>(event: K, handler: EventHandler<K>): void {
        appEventService.off(event, handler);
    }

    emit<K extends KnownEventName>(event: K, payload?: Parameters<typeof appEventService.emit<K>>[1]): void {
        appEventService.emit(event, payload);
    }
}

export const appEventController = new AppEventController();
export {AppEventController};
export type {EventHandler, KnownEventName, Unsubscribe};
