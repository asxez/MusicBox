import {api} from '@api/api';
import type {MusicBoxAPIEvents} from '@api/types/events';

type KnownEventName = keyof MusicBoxAPIEvents;
type EventHandler<K extends KnownEventName> = (payload: MusicBoxAPIEvents[K]) => void | Promise<void>;
type Unsubscribe = () => void;

class AppEventController {
    on<K extends KnownEventName>(event: K, handler: EventHandler<K>): Unsubscribe {
        api.on(event, handler);
        return () => this.off(event, handler);
    }

    off<K extends KnownEventName>(event: K, handler: EventHandler<K>): void {
        api.off(event, handler);
    }

    emit<K extends KnownEventName>(event: K, payload?: MusicBoxAPIEvents[K]): void {
        api.emit(event, payload);
    }
}

export const appEventController = new AppEventController();
export {AppEventController};
export type {EventHandler, KnownEventName, Unsubscribe};
