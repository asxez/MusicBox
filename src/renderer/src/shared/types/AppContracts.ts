import type {MusicBoxAPIEvents} from '@api/types/events';

export type AppView =
    | 'home-page'
    | 'library'
    | 'recent'
    | 'artists'
    | 'albums'
    | 'statistics'
    | 'playlist-detail'
    | 'network-drive-detail'
    | string;

export interface ManagedDOMListener {
    element: EventTarget;
    event: string;
    handler: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
}

export interface ManagedAPIListener<K extends keyof MusicBoxAPIEvents = keyof MusicBoxAPIEvents> {
    event: K;
    handler: (payload: MusicBoxAPIEvents[K]) => void | Promise<void>;
}

export interface ConfirmOptions {
    title: string;
    message: string;
    type?: 'default' | 'danger' | 'warning';
    confirmText?: string;
    cancelText?: string;
}
