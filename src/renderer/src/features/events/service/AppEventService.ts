import type {MusicBoxAPIEvents} from '@api/types/events';

export type KnownEventName = keyof MusicBoxAPIEvents;
export type EventHandler<K extends KnownEventName> = (payload: MusicBoxAPIEvents[K]) => void | Promise<void>;
export type Unsubscribe = () => void;

export interface AppEventBusPort {
    on<K extends KnownEventName>(event: K, handler: EventHandler<K>): void;
    off<K extends KnownEventName>(event: K, handler: EventHandler<K>): void;
    emit<K extends KnownEventName>(event: K, payload?: MusicBoxAPIEvents[K]): void;
}

export class AppEventService {
    private eventBus: AppEventBusPort | null = null;
    private readonly pendingHandlers = new Map<KnownEventName, Set<EventHandler<KnownEventName>>>();

    bindEventBus(eventBus: AppEventBusPort): void {
        if (this.eventBus === eventBus) {
            return;
        }

        this.eventBus = eventBus;
        this.bindPendingHandlers(eventBus);
    }

    on<K extends KnownEventName>(event: K, handler: EventHandler<K>): Unsubscribe {
        const typedHandler = handler as EventHandler<KnownEventName>;
        this.addPendingHandler(event, typedHandler);
        this.eventBus?.on(event, handler);

        return () => this.off(event, handler);
    }

    off<K extends KnownEventName>(event: K, handler: EventHandler<K>): void {
        const typedHandler = handler as EventHandler<KnownEventName>;
        this.removePendingHandler(event, typedHandler);
        this.eventBus?.off(event, handler);
    }

    emit<K extends KnownEventName>(event: K, payload?: MusicBoxAPIEvents[K]): void {
        if (!this.eventBus) {
            return;
        }

        this.eventBus.emit(event, payload);
    }

    private addPendingHandler(event: KnownEventName, handler: EventHandler<KnownEventName>): void {
        const handlers = this.pendingHandlers.get(event) ?? new Set<EventHandler<KnownEventName>>();
        handlers.add(handler);
        this.pendingHandlers.set(event, handlers);
    }

    private removePendingHandler(event: KnownEventName, handler: EventHandler<KnownEventName>): void {
        const handlers = this.pendingHandlers.get(event);
        if (!handlers) {
            return;
        }

        handlers.delete(handler);
        if (handlers.size === 0) {
            this.pendingHandlers.delete(event);
        }
    }

    private bindPendingHandlers(eventBus: AppEventBusPort): void {
        this.pendingHandlers.forEach((handlers, event) => {
            handlers.forEach((handler) => {
                eventBus.on(event, handler);
            });
        });
    }
}

export const appEventService = new AppEventService();
