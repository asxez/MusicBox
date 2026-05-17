import {api} from '@api/api';
import type {MusicBoxAPIEvents} from '@api/types/events';

export type KnownEventName = keyof MusicBoxAPIEvents;
export type EventHandler<K extends KnownEventName> = (payload: MusicBoxAPIEvents[K]) => void | Promise<void>;
export type Unsubscribe = () => void;

export class AppEventService {
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

export const appEventService = new AppEventService();
