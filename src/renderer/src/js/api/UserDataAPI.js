class UserDataAPI {
    async getMoodHistory() {
        try {
            return await window.electronAPI.userdata.getMoodHistory();
        } catch (error) {
            console.error('获取心情历史失败:', error);
            return [];
        }
    }

    async saveMood(moodData) {
        try {
            return await window.electronAPI.userdata.saveMood(moodData);
        } catch (error) {
            console.error('保存心情记录失败:', error);
            return {success: false, error: error.message};
        }
    }

    async getDiaryHistory() {
        try {
            return await window.electronAPI.userdata.getDiaryHistory();
        } catch (error) {
            console.error('获取日记历史失败:', error);
            return [];
        }
    }

    async saveDiary(diaryData) {
        try {
            return await window.electronAPI.userdata.saveDiary(diaryData);
        } catch (error) {
            console.error('保存日记记录失败:', error);
            return {success: false, error: error.message};
        }
    }

    async deleteMood(timestamp) {
        try {
            return await window.electronAPI.userdata.deleteMood(timestamp);
        } catch (error) {
            console.error('删除心情记录失败:', error);
            return {success: false, error: error.message};
        }
    }

    async deleteDiary(timestamp) {
        try {
            return await window.electronAPI.userdata.deleteDiary(timestamp);
        } catch (error) {
            console.error('删除日记记录失败:', error);
            return {success: false, error: error.message};
        }
    }
}

let userDataAPI = new UserDataAPI();
export {userDataAPI};
