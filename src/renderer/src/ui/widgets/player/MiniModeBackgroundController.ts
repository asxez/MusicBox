class MiniModeBackgroundController {
    private readonly trackCover: HTMLImageElement;

    constructor(trackCover: HTMLImageElement) {
        this.trackCover = trackCover;
    }

    async update(): Promise<void> {
        const coverImg = this.trackCover;
        if (
            coverImg &&
            coverImg.complete &&
            coverImg.naturalWidth > 0 &&
            coverImg.src &&
            !coverImg.src.includes('default-cover.svg')
        ) {
            try {
                const dominantColor = await this.extractDominantColor(coverImg);
                document.documentElement.style.setProperty('--mini-mode-bg-color', dominantColor);
                return;
            } catch (error) {
                console.error('❌ MiniModeBackgroundController: 提取封面主色失败:', error);
            }
        }

        this.setDefaultBackground();
    }

    clear(): void {
        document.documentElement.style.removeProperty('--mini-mode-bg-color');
    }

    private async extractDominantColor(imgElement: HTMLImageElement): Promise<string> {
        return new Promise((resolve) => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve('60, 80, 120');
                    return;
                }

                canvas.width = imgElement.naturalWidth || imgElement.width;
                canvas.height = imgElement.naturalHeight || imgElement.height;
                ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                let r = 0;
                let g = 0;
                let b = 0;
                let count = 0;

                for (let i = 0; i < data.length; i += 40) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }

                r = Math.round(r / count);
                g = Math.round(g / count);
                b = Math.round(b / count);

                const brightness = (r + g + b) / 3;
                if (brightness > 200) {
                    r = Math.round(r * 0.6);
                    g = Math.round(g * 0.6);
                    b = Math.round(b * 0.6);
                } else if (brightness < 50) {
                    r = Math.min(255, Math.round(r * 1.5));
                    g = Math.min(255, Math.round(g * 1.5));
                    b = Math.min(255, Math.round(b * 1.5));
                }

                resolve(`${r}, ${g}, ${b}`);
            } catch (error) {
                console.error('❌ MiniModeBackgroundController: 读取封面像素失败:', error);
                resolve('60, 80, 120');
            }
        });
    }

    private setDefaultBackground(): void {
        document.documentElement.style.setProperty('--mini-mode-bg-color', '60, 80, 120');
    }
}

export {MiniModeBackgroundController};
