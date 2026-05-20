export interface LyricsWordDom {
    text: string;
    time: number;
}

export function appendLyricsWordSpans(container: Element, words: readonly LyricsWordDom[]): void {
    container.textContent = '';
    container.appendChild(createLyricsWordFragment(words));
}

export function createLyricsWordFragment(words: readonly LyricsWordDom[]): DocumentFragment {
    const fragment = document.createDocumentFragment();

    for (const [index, word] of words.entries()) {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'lyric-word';
        wordSpan.dataset.wordIndex = String(index);
        wordSpan.dataset.wordTime = String(word.time);
        wordSpan.dataset.wordText = word.text;
        wordSpan.textContent = word.text;
        wordSpan.dataset.wordProgress = '0';
        wordSpan.style.setProperty('--word-progress', '0');
        wordSpan.style.setProperty('--word-reveal-inset', '100%');
        fragment.appendChild(wordSpan);
    }

    return fragment;
}

export function getLyricsWordText(words: readonly LyricsWordDom[]): string {
    return words.map(word => word.text).join('');
}
