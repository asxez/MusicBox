import type WebAudioEqualizer from '@/features/equalizer/service/WebAudioEqualizer';

type WebAudioChainOptions = {
    audioContext: AudioContext;
    sourceNode: AudioNode;
    gainNode: GainNode;
    equalizer: WebAudioEqualizer | null;
    equalizerEnabled: boolean;
};

class WebAudioChain {
    connect(options: WebAudioChainOptions): void {
        const {audioContext, sourceNode, gainNode, equalizer, equalizerEnabled} = options;
        console.log('🔗 开始连接音频源到音频链...');

        try {
            gainNode.disconnect();
            gainNode.connect(audioContext.destination);
            console.log('✅ gainNode -> destination 连接确保');
        } catch (error) {
            console.warn('⚠️ gainNode连接确保失败:', error);
        }

        if (equalizer && equalizerEnabled) {
            console.log('🔗 使用均衡器路径: sourceNode -> equalizer.input -> [滤波器链] -> equalizer.output -> gainNode -> destination');
            try {
                equalizer.output?.disconnect();
                equalizer.output?.connect(gainNode);
                console.log('✅ equalizer.output -> gainNode 连接确保');

                if (!equalizer.input) {
                    throw new Error('equalizer.input is not available');
                }
                sourceNode.connect(equalizer.input);
                console.log('✅ sourceNode -> equalizer.input 连接成功');
                return;
            } catch (error) {
                console.error('❌ 均衡器音频链连接失败:', error);
                this.connectDirect(sourceNode, gainNode, true);
                return;
            }
        }

        this.connectDirect(sourceNode, gainNode);
    }

    reconnect(options: WebAudioChainOptions): boolean {
        const {audioContext, sourceNode, gainNode, equalizer, equalizerEnabled} = options;
        console.log('🔄 开始重新连接音频链（实时切换模式）...');

        try {
            sourceNode.disconnect();
        } catch (error) {
            console.warn('⚠️ sourceNode断开失败:', error);
        }

        try {
            equalizer?.output?.disconnect();
        } catch (error) {
            console.warn('⚠️ equalizer.output断开失败:', error);
        }

        try {
            gainNode.disconnect();
            gainNode.connect(audioContext.destination);
        } catch (error) {
            console.warn('⚠️ gainNode重连失败:', error);
        }

        try {
            if (equalizer && equalizerEnabled) {
                console.log('🔗 使用均衡器路径: sourceNode -> equalizer -> gainNode -> destination');
                equalizer.output?.connect(gainNode);
                console.log('✅ equalizer.output -> gainNode 重新连接成功');

                if (!equalizer.input) {
                    throw new Error('equalizer.input is not available');
                }
                sourceNode.connect(equalizer.input);
                console.log('✅ sourceNode -> equalizer.input 重新连接成功');
            } else {
                this.connectDirect(sourceNode, gainNode);
            }

            return true;
        } catch (error) {
            console.error('❌ 音频链重新连接失败:', error);
            try {
                sourceNode.disconnect();
                sourceNode.connect(gainNode);
                return true;
            } catch (recoveryError) {
                console.error('❌ 恢复基本连接也失败:', recoveryError);
                return false;
            }
        }
    }

    private connectDirect(sourceNode: AudioNode, gainNode: GainNode, fallback = false): void {
        const prefix = fallback ? '🔄 回退到直接连接' : '🔗 使用直接路径';
        console.log(`${prefix}: sourceNode -> gainNode -> destination`);
        try {
            sourceNode.connect(gainNode);
            console.log('✅ sourceNode -> gainNode 连接成功');
        } catch (error) {
            console.error('❌ 直接音频链连接失败:', error);
        }
    }
}

export const webAudioChain = new WebAudioChain();
export {WebAudioChain};
