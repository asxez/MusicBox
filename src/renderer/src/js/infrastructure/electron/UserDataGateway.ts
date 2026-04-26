import {ElectronNamespaceAdapter} from './ElectronBridge';

class UserDataGateway extends ElectronNamespaceAdapter<'userdata'> {
    constructor() {
        super('userdata');
    }

    getMoodHistory(): Promise<any[]> {
        return this.call('getMoodHistory');
    }

    saveMood(moodData: unknown): Promise<any> {
        return this.call('saveMood', moodData);
    }

    getDiaryHistory(): Promise<any[]> {
        return this.call('getDiaryHistory');
    }

    saveDiary(diaryData: unknown): Promise<any> {
        return this.call('saveDiary', diaryData);
    }

    deleteMood(timestamp: number): Promise<any> {
        return this.call('deleteMood', timestamp);
    }

    deleteDiary(timestamp: number): Promise<any> {
        return this.call('deleteDiary', timestamp);
    }
}

export const userDataGateway = new UserDataGateway();
