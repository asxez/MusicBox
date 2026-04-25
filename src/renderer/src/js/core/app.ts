import {createMusicBoxApp} from './bootstrap/createMusicBoxApp';
import type {MusicBoxApp as ExtensionMusicBoxApp} from '@extensions/core/types';

const musicBoxApp = createMusicBoxApp() as unknown as ExtensionMusicBoxApp;

export {musicBoxApp as app};
