<template>
  <view class="container">
    <view class="header">
      <text class="title">🎾 创建球局</text>
      <text class="subtitle">在 {{ courtName }} 发起一场匹克球比赛</text>
    </view>

    <view class="form-card">
      <view class="form-group">
        <text class="form-label">球局标题</text>
        <input
          class="form-input"
          type="text"
          placeholder="例如：双打休闲局"
          v-model="form.title"
        />
      </view>

      <view class="form-group">
        <text class="form-label">描述（可选）</text>
        <input
          class="form-input"
          type="text"
          placeholder="描述一下水平/要求..."
          v-model="form.description"
        />
      </view>

      <view class="form-group">
        <text class="form-label">比赛时间</text>
        <picker mode="date" :value="form.date" @change="onDateChange">
          <view class="picker-display">{{ form.date || '选择日期' }}</view>
        </picker>
        <picker mode="time" :value="form.time" @change="onTimeChange">
          <view class="picker-display">{{ form.time || '选择时间' }}</view>
        </picker>
      </view>

      <view class="form-group">
        <text class="form-label">最大人数</text>
        <picker mode="selector" :range="playerOptions" :value="form.maxPlayersIndex" @change="onMaxPlayersChange">
          <view class="picker-display">{{ playerOptions[form.maxPlayersIndex] }}</view>
        </picker>
      </view>

      <view class="form-group">
        <text class="form-label">技能要求范围</text>
        <view class="skill-row">
          <view class="skill-picker">
            <text class="skill-label">最低</text>
            <picker mode="selector" :range="skillOptions" :value="form.skillMinIndex" @change="onSkillMinChange">
              <view class="picker-display small">{{ skillOptions[form.skillMinIndex] }}</view>
            </picker>
          </view>
          <text class="skill-sep">~</text>
          <view class="skill-picker">
            <text class="skill-label">最高</text>
            <picker mode="selector" :range="skillOptions" :value="form.skillMaxIndex" @change="onSkillMaxChange">
              <view class="picker-display small">{{ skillOptions[form.skillMaxIndex] }}</view>
            </picker>
          </view>
        </view>
      </view>

      <button class="submit-btn" @tap="handleCreate" :disabled="submitting">
        {{ submitting ? '创建中...' : '创建球局' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { apiRequest } from '../../services/api';

const courtId = ref('');
const courtName = ref('');

const playerOptions = ['2 人 (单打)', '3 人', '4 人 (双打)', '5 人', '6 人', '8 人'];
const skillOptions = ['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'];

const form = ref({
  title: '',
  description: '',
  date: '',
  time: '',
  maxPlayersIndex: 2, // Default 4人
  skillMinIndex: 0,
  skillMaxIndex: 3,
});

const submitting = ref(false);

onMounted(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as any;
  if (page && page.options) {
    courtId.value = page.options.courtId || '';
    courtName.value = page.options.courtName || '该球场';
  }
  // Set default date/time to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  form.value.date = formatDate(tomorrow);
  form.value.time = '18:00';
});

const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const onDateChange = (e: any) => {
  form.value.date = e.detail.value;
};

const onTimeChange = (e: any) => {
  form.value.time = e.detail.value;
};

const onMaxPlayersChange = (e: any) => {
  form.value.maxPlayersIndex = e.detail.value;
};

const onSkillMinChange = (e: any) => {
  form.value.skillMinIndex = e.detail.value;
  // Ensure min <= max
  if (form.value.skillMinIndex > form.value.skillMaxIndex) {
    form.value.skillMaxIndex = form.value.skillMinIndex;
  }
};

const onSkillMaxChange = (e: any) => {
  form.value.skillMaxIndex = e.detail.value;
  // Ensure max >= min
  if (form.value.skillMaxIndex < form.value.skillMinIndex) {
    form.value.skillMinIndex = form.value.skillMaxIndex;
  }
};

const handleCreate = async () => {
  if (!form.value.title.trim()) {
    uni.showToast({ title: '请输入球局标题', icon: 'none' });
    return;
  }

  if (!courtId.value) {
    uni.showToast({ title: '球场信息缺失', icon: 'none' });
    return;
  }

  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }

  submitting.value = true;

  const playTime = `${form.value.date}T${form.value.time}:00.000Z`;
  const maxPlayers = parseInt(playerOptions[form.value.maxPlayersIndex]);
  const skillMin = parseFloat(skillOptions[form.value.skillMinIndex]);
  const skillMax = parseFloat(skillOptions[form.value.skillMaxIndex]);

  try {
    const res = await apiRequest<any>({
      url: '/play-sessions',
      method: 'POST',
      data: {
        title: form.value.title,
        description: form.value.description || undefined,
        courtId: courtId.value,
        maxPlayers,
        skillMin,
        skillMax,
        playTime,
      },
    });

    if (res.statusCode === 201) {
      uni.showToast({ title: '球局创建成功！', icon: 'success' });
      // Navigate back with refresh flag
      const pages = getCurrentPages();
      if (pages.length > 1) {
        uni.navigateBack();
      }
    } else {
      const msg = res.data?.message || '创建失败';
      uni.showToast({ title: msg, icon: 'none' });
    }
  } catch (err: any) {
    uni.showToast({ title: err.message || '网络错误', icon: 'none' });
  } finally {
    submitting.value = false;
  }
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #121212;
  padding: 30rpx;
  color: #FFFFFF;
}

.header {
  margin-bottom: 40rpx;
  
  .title {
    font-size: 44rpx;
    font-weight: 800;
    color: #C1F80A;
  }
  
  .subtitle {
    font-size: 26rpx;
    color: #8E8E93;
    margin-top: 10rpx;
    display: block;
  }
}

.form-card {
  background-color: #1E1E1E;
  border-radius: 24rpx;
  padding: 30rpx;
  border: 1px solid #2C2C2C;
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  
  .form-label {
    font-size: 26rpx;
    font-weight: 600;
    color: #FFFFFF;
  }
  
  .form-input {
    background-color: #121212;
    border: 1px solid #2C2C2C;
    border-radius: 12rpx;
    padding: 20rpx 25rpx;
    color: #FFFFFF;
    font-size: 28rpx;
  }
}

.picker-display {
  background-color: #121212;
  border: 1px solid #2C2C2C;
  border-radius: 12rpx;
  padding: 20rpx 25rpx;
  color: #FFFFFF;
  font-size: 28rpx;
  
  &.small {
    padding: 15rpx 20rpx;
    font-size: 26rpx;
    text-align: center;
  }
}

.skill-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  
  .skill-picker {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    
    .skill-label {
      font-size: 22rpx;
      color: #8E8E93;
    }
  }
  
  .skill-sep {
    color: #8E8E93;
    font-size: 28rpx;
    margin-top: 30rpx;
  }
}

.submit-btn {
  background-color: #C1F80A;
  color: #121212;
  font-weight: 700;
  font-size: 30rpx;
  border-radius: 40rpx;
  padding: 22rpx 0;
  text-align: center;
  line-height: 1.2;
  margin-top: 10rpx;
  border: none;
  
  &[disabled] {
    opacity: 0.5;
  }
}
</style>