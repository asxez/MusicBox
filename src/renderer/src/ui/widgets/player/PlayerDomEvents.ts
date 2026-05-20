type ManagedDomTarget = EventTarget & {
    addEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: AddEventListenerOptions | boolean): void;
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject, options?: EventListenerOptions | boolean): void;
};

type AddManagedDomListener = (
    element: ManagedDomTarget,
    event: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
) => void;

type RemoveManagedDomListener = (
    element: ManagedDomTarget,
    event: string,
    handler: EventListenerOrEventListenerObject
) => void;

export type {AddManagedDomListener, ManagedDomTarget, RemoveManagedDomListener};
