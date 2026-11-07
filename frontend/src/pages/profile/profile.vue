<template>
  <view class="container">
    <!-- Profile Card (Header) -->
    <view class="profile-card">
      <view class="avatar-container">
        <image class="avatar" :src="userStore.user?.avatarUrl || defaultAvatar" mode="aspectFill" />
        <view class="level-badge" v-if="userStore.isLoggedIn">
          <text class="level-text">{{ (userStore.user?.skillLevel ?? 3.5).toFixed(1) }}</text>
        </view>
      </view>

      <view class="user-meta" v-if="userStore.isLoggedIn">
        <text class="nickname">{{ userStore.user?.nickname }}</text>
        <text class="bio-text" v-if="userStore.user?.bio">{{ userStore.user.bio }}</text>
        <view :class="['status-pill', userStore.isActiveUser ? 'active' : 'inactive']">
          <text class="status-dot">{{ userStore.isActiveUser ? '🟢' : '🟠' }}</text>
          <text class="status-label">
            {{ userStore.isActiveUser ? `已激活用户 (${userStore.user?.phone})` : '未激活用户 (仅浏览权限)' }}
          </text>
        </view>
      </view>
      
      <view class="login-prompt" v-else>
        <text class="prompt-title">欢迎来到 PickleMate</text>
        <text class="prompt-subtitle">登录后可记录签到、收藏球场并参与约球群聊</text>
        <view class="login-btn-group">
          <button class="phone-login-btn" @tap="openOtpModal('login')">
            📱 手机验证码登录
          </button>
          <button class="apple-login-btn" @tap="handleAppleLogin">
             Apple 快捷体验 (未激活浏览)
          </button>
        </view>
      </view>
    </view>

    <!-- ADR-0001 Two-Stage Activation Banner for Inactive Users -->
    <view v-if="userStore.isLoggedIn && !userStore.isActiveUser" class="activation-banner">
      <view class="banner-text-col">
        <text class="banner-title">🔒 升级为激活用户 (Active User)</text>
        <text class="banner-desc">绑定验证手机号后即可解锁创建球场、签到、发起/加入球局及群聊发言权限。</text>
      </view>
      <button class="banner-btn" @tap="openOtpModal('link')">立即绑定</button>
    </view>

    <!-- Stats Panel -->
    <view class="stats-panel" v-if="userStore.isLoggedIn">
      <view class="stat-box">
        <text class="stat-value">{{ userStore.stats.checkInsCount }}</text>
        <text class="stat-label">签到次数</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-box">
        <text class="stat-value">{{ userStore.stats.favoriteCourtsCount }}</text>
        <text class="stat-label">收藏球场</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-box">
        <text class="stat-value">{{ userStore.stats.hostedSessionsCount }}</text>
        <text class="stat-label">发起球局</text>
      </view>
    </view>

    <!-- Player Profile Details & Editor -->
    <view class="section-card" v-if="userStore.isLoggedIn">
      <view class="section-header-row">
        <text class="section-title">个人资料与技术评级</text>
        <text class="section-action" @tap="showEditModal = true">编辑资料</text>
      </view>
      
      <view class="profile-row">
        <text class="row-label">DUPR / 自评等级</text>
        <picker 
          mode="selector" 
          :range="skillLevels" 
          :value="skillIndex" 
          @change="onSkillChange"
        >
          <view class="picker-row">
            <text class="row-value highlighted">{{ skillLevels[skillIndex] }}</text>
            <text class="arrow">▶</text>
          </view>
        </picker>
      </view>

      <view class="profile-row">
        <text class="row-label">个人简介</text>
        <text class="row-value">{{ userStore.user?.bio || '点击右上角添加球风简介' }}</text>
      </view>
    </view>

    <!-- My Favorite Courts -->
    <view class="section-card" v-if="userStore.isLoggedIn">
      <view class="section-header-row">
        <text class="section-title">我的收藏球场 ({{ favoriteCourts.length }})</text>
      </view>

      <view class="empty-schedule" v-if="favoriteCourts.length === 0">
        <text class="empty-text">还没有收藏任何球场</text>
        <text class="empty-subtext" @tap="findMatches">去地图浏览并收藏常去的球场</text>
      </view>

      <view class="schedule-list" v-else>
        <view
          v-for="fav in favoriteCourts"
          :key="fav.id"
          class="schedule-item"
          @tap="goToCourt(fav.court?.id || fav.courtId)"
        >
          <view class="schedule-indicator"></view>
          <view class="schedule-details">
            <text class="schedule-title">{{ fav.court?.name || '球场' }}</text>
            <text class="schedule-court">{{ fav.court?.address || '' }}</text>
          </view>
          <text class="arrow">▶</text>
        </view>
      </view>
    </view>

    <!-- My Upcoming Play Sessions -->
    <view class="section-card" v-if="userStore.isLoggedIn">
      <view class="section-header-row">
        <text class="section-title">我发起的球局</text>
        <text class="section-action" @tap="goToSessionsTab">查看全部</text>
      </view>

      <view class="empty-schedule" v-if="upcomingSessions.length === 0">
        <text class="empty-text">暂无即将开始的球局</text>
        <text class="empty-subtext" @tap="goToSessionsTab">前往球局广场找局</text>
      </view>

      <view class="schedule-list" v-else>
        <view 
          v-for="session in upcomingSessions" 
          :key="session.id" 
          class="schedule-item"
          @tap="goToSessionDetail(session.id)"
        >
          <view class="schedule-indicator"></view>
          <view class="schedule-details">
            <text class="schedule-title">{{ session.title }}</text>
            <text class="schedule-court">{{ session.courtName }}</text>
            <text class="schedule-time">📅 {{ session.time }}</text>
          </view>
          <view class="schedule-players-badge">
            <text class="players-count">{{ session.playersCount }}/{{ session.maxPlayers }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Logout -->
    <view class="settings-list" v-if="userStore.isLoggedIn">
      <button class="logout-btn" @tap="handleLogout">退出登录</button>
    </view>

    <!-- Phone OTP Login / Link Modal -->
    <view v-if="showOtpModal" class="modal-backdrop">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">{{ otpMode === 'link' ? '绑定手机号激活账号' : '手机验证码登录' }}</text>
          <text class="modal-close" @tap="showOtpModal = false">✕</text>
        </view>
        <view class="modal-body">
          <input
            class="modal-input"
            type="number"
            maxlength="11"
            placeholder="请输入手机号"
            v-model="otpPhone"
          />
          <view class="code-row">
            <input
              class="modal-input flex-1"
              type="number"
              maxlength="4"
              placeholder="4位验证码"
              v-model="otpCode"
            />
            <button class="code-btn" @tap="handleSendOtp">获取验证码</button>
          </view>
          <text v-if="devOtpCode" class="otp-hint">开发环境验证码: {{ devOtpCode }}</text>
          <button class="submit-btn" @tap="handleVerifyOtp">
            {{ otpMode === 'link' ? '确认绑定并激活' : '登录 / 注册' }}
          </button>
        </view>
      </view>
    </view>

    <!-- Edit Profile Modal -->
    <view v-if="showEditModal" class="modal-backdrop">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">编辑个人资料</text>
          <text class="modal-close" @tap="showEditModal = false">✕</text>
        </view>
        <view class="modal-body">
          <text class="input-label">昵称</text>
          <input class="modal-input" type="text" v-model="editForm.nickname" placeholder="输入昵称" />
          <text class="input-label">个人简介</text>
          <input class="modal-input" type="text" v-model="editForm.bio" placeholder="介绍一下你的打球风格..." />
          <button class="submit-btn" @tap="submitEditProfile">保存修改</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useUserStore } from '../../stores/user';
import { apiRequest } from '../../services/api';

const defaultAvatar = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback';
const userStore = useUserStore();

const skillLevels = [
  '2.0 (新手 Beginner)',
  '2.5 (进阶新手)',
  '3.0 (中级 Intermediate)',
  '3.5 (熟练中级)',
  '4.0 (高级 Advanced)',
  '4.5 (专业 Pro)',
];
const skillIndex = ref(3);

const upcomingSessions = ref<any[]>([]);
const favoriteCourts = ref<any[]>([]);

const showOtpModal = ref(false);
const otpMode = ref<'login' | 'link'>('login');
const otpPhone = ref('');
const otpCode = ref('');
const devOtpCode = ref('');

const showEditModal = ref(false);
const editForm = ref({
  nickname: '',
  bio: '',
});

onMounted(() => {
  refreshAll();
});

onShow(() => {
  refreshAll();
});

const refreshAll = async () => {
  userStore.hydrate();
  if (!userStore.isLoggedIn) return;

  await userStore.fetchProfile();
  if (userStore.user) {
    editForm.value.nickname = userStore.user.nickname || '';
    editForm.value.bio = userStore.user.bio || '';
    const idx = skillLevels.findIndex((s) => s.startsWith((userStore.user?.skillLevel ?? 3.5).toFixed(1)));
    if (idx >= 0) skillIndex.value = idx;
  }

  // Fetch hosted sessions
  const sessionRes = await apiRequest<any>({
    url: '/play-sessions/hosted/sessions?upcomingOnly=true&page=1&limit=10',
    method: 'GET',
  });
  if (sessionRes.statusCode === 200 && sessionRes.data?.data) {
    upcomingSessions.value = sessionRes.data.data.map((s: any) => ({
      id: s.id,
      title: s.title,
      courtName: s.court?.name || '未知球场',
      time: formatSessionTime(s.playTime),
      playersCount: s.playerCount || 0,
      maxPlayers: s.maxPlayers || 4,
    }));
  }

  // Fetch favorites if active user
  if (userStore.isActiveUser) {
    const favRes = await apiRequest<any[]>({
      url: '/favorites',
      method: 'GET',
    });
    if (favRes.statusCode === 200 && Array.isArray(favRes.data)) {
      favoriteCourts.value = favRes.data;
    }
  } else {
    favoriteCourts.value = [];
  }
};

const formatSessionTime = (isoStr: string) => {
  const d = new Date(isoStr);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const openOtpModal = (mode: 'login' | 'link') => {
  otpMode.value = mode;
  otpPhone.value = '';
  otpCode.value = '';
  devOtpCode.value = '';
  showOtpModal.value = true;
};

const handleSendOtp = async () => {
  if (!otpPhone.value || otpPhone.value.length < 8) {
    uni.showToast({ title: '请输入有效手机号', icon: 'none' });
    return;
  }
  const res = await userStore.requestOtp(otpPhone.value);
  if (res.statusCode === 201 && res.data?.code) {
    devOtpCode.value = res.data.code;
    otpCode.value = res.data.code;
    uni.showToast({ title: '验证码已发送', icon: 'success' });
  } else {
    uni.showToast({ title: (res.data as any)?.message || '发送失败', icon: 'none' });
  }
};

const handleVerifyOtp = async () => {
  if (!otpPhone.value || !otpCode.value) {
    uni.showToast({ title: '请填写手机号与验证码', icon: 'none' });
    return;
  }
  if (otpMode.value === 'link') {
    const res = await userStore.linkPhone(otpPhone.value, otpCode.value);
    if (res.statusCode === 201) {
      showOtpModal.value = false;
      uni.showToast({ title: '账号已激活！', icon: 'success' });
      refreshAll();
    } else {
      uni.showToast({ title: (res.data as any)?.message || '绑定失败', icon: 'none' });
    }
  } else {
    const res = await userStore.verifyOtp(otpPhone.value, otpCode.value);
    if (res.statusCode === 201) {
      showOtpModal.value = false;
      uni.showToast({ title: '登录成功！', icon: 'success' });
      refreshAll();
    } else {
      uni.showToast({ title: (res.data as any)?.message || '登录失败', icon: 'none' });
    }
  }
};

const handleAppleLogin = async () => {
  const res = await userStore.appleQuickLogin();
  if (res.statusCode === 201) {
    uni.showToast({ title: '已作为未激活用户登录', icon: 'none' });
    refreshAll();
  }
};

const onSkillChange = async (e: any) => {
  skillIndex.value = e.detail.value;
  const match = skillLevels[skillIndex.value].match(/^([0-9.]+)/);
  if (match) {
    const level = parseFloat(match[1]);
    await userStore.updateProfile({ skillLevel: level });
    uni.showToast({ title: `技能等级已更新为 ${level.toFixed(1)}`, icon: 'success' });
  }
};

const submitEditProfile = async () => {
  const res = await userStore.updateProfile({
    nickname: editForm.value.nickname.trim() || undefined,
    bio: editForm.value.bio.trim(),
  });
  if (res.statusCode === 200) {
    showEditModal.value = false;
    uni.showToast({ title: '资料已保存', icon: 'success' });
  } else {
    uni.showToast({ title: (res.data as any)?.message || '保存失败', icon: 'none' });
  }
};

const handleLogout = () => {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出当前账号吗？',
    success: async (res) => {
      if (res.confirm) {
        await userStore.logout();
        upcomingSessions.value = [];
        favoriteCourts.value = [];
        uni.showToast({ title: '已退出登录', icon: 'none' });
      }
    },
  });
};

const findMatches = () => {
  uni.switchTab({ url: '/pages/index/index' });
};

const goToSessionsTab = () => {
  uni.switchTab({ url: '/pages/play-session/list' });
};

const goToCourt = (id: string) => {
  if (id) uni.navigateTo({ url: `/pages/court/detail?id=${id}` });
};

const goToSessionDetail = (id: string) => {
  if (id) uni.navigateTo({ url: `/pages/play-session/detail?id=${id}` });
};
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #121212;
  color: #FFFFFF;
  padding: 30rpx;
  box-sizing: border-box;
}

.profile-card {
  background-color: #1E1E1E;
  border-radius: 24rpx;
  padding: 40rpx;
  display: flex;
  align-items: center;
  gap: 35rpx;
  margin-bottom: 25rpx;
  border: 1px solid #2C2C2C;
}

.avatar-container {
  position: relative;
  
  .avatar {
    width: 130rpx;
    height: 130rpx;
    border-radius: 50%;
    border: 4rpx solid #C1F80A;
  }
  
  .level-badge {
    position: absolute;
    bottom: -5rpx;
    right: -5rpx;
    background-color: #C1F80A;
    color: #121212;
    font-weight: 800;
    font-size: 20rpx;
    padding: 2rpx 10rpx;
    border-radius: 12rpx;
    border: 3rpx solid #1E1E1E;
  }
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  flex: 1;
  
  .nickname {
    font-size: 38rpx;
    font-weight: 700;
  }

  .bio-text {
    font-size: 24rpx;
    color: #8E8E93;
  }
}

.status-pill {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 14rpx;
  border-radius: 20rpx;
  align-self: flex-start;

  &.active {
    background-color: rgba(193, 248, 10, 0.12);
    border: 1px solid rgba(193, 248, 10, 0.3);
    .status-label { color: #C1F80A; }
  }

  &.inactive {
    background-color: rgba(255, 149, 0, 0.12);
    border: 1px solid rgba(255, 149, 0, 0.3);
    .status-label { color: #FF9500; }
  }

  .status-dot { font-size: 16rpx; }
  .status-label { font-size: 20rpx; font-weight: 600; }
}

.activation-banner {
  background-color: rgba(255, 149, 0, 0.12);
  border: 1px solid #FF9500;
  border-radius: 20rpx;
  padding: 24rpx;
  margin-bottom: 25rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;

  .banner-text-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;

    .banner-title {
      font-size: 26rpx;
      font-weight: 700;
      color: #FF9500;
    }

    .banner-desc {
      font-size: 22rpx;
      color: #CCCCCC;
      line-height: 1.4;
    }
  }

  .banner-btn {
    background-color: #FF9500;
    color: #121212;
    font-size: 24rpx;
    font-weight: 700;
    padding: 14rpx 24rpx;
    border-radius: 30rpx;
    line-height: 1.2;
  }
}

.login-prompt {
  display: flex;
  flex-direction: column;
  flex: 1;
  align-items: center;
  text-align: center;
  
  .prompt-title {
    font-size: 34rpx;
    font-weight: 700;
    color: #FFFFFF;
    margin-bottom: 10rpx;
  }
  
  .prompt-subtitle {
    font-size: 22rpx;
    color: #8E8E93;
    margin-bottom: 25rpx;
  }

  .login-btn-group {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
  }
  
  .phone-login-btn {
    width: 100%;
    background-color: #C1F80A;
    color: #121212;
    font-size: 26rpx;
    font-weight: 700;
    border-radius: 40rpx;
    padding: 16rpx 0;
    line-height: 1.4;
  }

  .apple-login-btn {
    width: 100%;
    background-color: #2C2C2C;
    color: #FFFFFF;
    font-size: 24rpx;
    font-weight: 600;
    border-radius: 40rpx;
    padding: 14rpx 0;
    line-height: 1.4;
  }
}

.stats-panel {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: #1E1E1E;
  border-radius: 20rpx;
  padding: 25rpx 10rpx;
  margin-bottom: 30rpx;
  border: 1px solid #2C2C2C;
  
  .stat-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }
  
  .stat-value {
    font-size: 36rpx;
    font-weight: 800;
    color: #C1F80A;
  }
  
  .stat-label {
    font-size: 20rpx;
    color: #8E8E93;
    margin-top: 6rpx;
  }
  
  .stat-divider {
    width: 1px;
    height: 40rpx;
    background-color: #2C2C2C;
  }
}

.section-card {
  background-color: #1E1E1E;
  border-radius: 20rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  border: 1px solid #2C2C2C;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
}

.section-title {
  font-size: 30rpx;
  font-weight: 700;
  color: #FFFFFF;
  border-left: 6rpx solid #C1F80A;
  padding-left: 15rpx;
}

.section-action {
  font-size: 24rpx;
  color: #C1F80A;
  font-weight: 600;
}

.profile-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15rpx 0;
  border-bottom: 1px solid #2C2C2C;
  
  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }
  
  .row-label {
    font-size: 26rpx;
    color: #8E8E93;
  }
  
  .row-value {
    font-size: 26rpx;
    color: #FFFFFF;
    font-weight: 500;
    
    &.highlighted {
      color: #C1F80A;
      font-weight: 600;
    }
  }
}

.picker-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.empty-schedule {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30rpx 0;
  
  .empty-text {
    font-size: 24rpx;
    color: #8E8E93;
    margin-bottom: 10rpx;
  }
  
  .empty-subtext {
    font-size: 24rpx;
    color: #C1F80A;
    font-weight: 600;
    text-decoration: underline;
  }
}

.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.schedule-item {
  display: flex;
  align-items: center;
  background-color: #252525;
  border-radius: 12rpx;
  padding: 20rpx;
  gap: 20rpx;
}

.schedule-indicator {
  width: 8rpx;
  height: 70rpx;
  background-color: #C1F80A;
  border-radius: 4rpx;
}

.schedule-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  
  .schedule-title {
    font-size: 26rpx;
    font-weight: 700;
  }
  
  .schedule-court {
    font-size: 22rpx;
    color: #8E8E93;
  }
  
  .schedule-time {
    font-size: 20rpx;
    color: #C1F80A;
    font-weight: 500;
  }
}

.schedule-players-badge {
  background-color: #1E1E1E;
  padding: 6rpx 16rpx;
  border-radius: 10rpx;
  border: 1px solid #333333;
  
  .players-count {
    color: #FFFFFF;
    font-size: 22rpx;
    font-weight: 700;
  }
}

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 10rpx;
}

.arrow {
  color: #555555;
  font-size: 18rpx;
}

.logout-btn {
  background-color: #FF3B30;
  color: #FFFFFF;
  font-size: 26rpx;
  font-weight: 700;
  border-radius: 40rpx;
  padding: 15rpx 0;
  border: none;
  margin-top: 10rpx;
  line-height: 1.5;
}

.modal-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  padding: 40rpx;
}

.modal-content {
  width: 100%;
  background-color: #1E1E1E;
  border-radius: 24rpx;
  border: 1px solid #2C2C2C;
}

.modal-header {
  padding: 30rpx;
  border-bottom: 1px solid #2C2C2C;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .modal-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #C1F80A;
  }
  
  .modal-close {
    font-size: 32rpx;
    color: #8E8E93;
    padding: 10rpx;
  }
}

.modal-body {
  padding: 30rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.input-label {
  font-size: 24rpx;
  color: #8E8E93;
}

.modal-input {
  background-color: #121212;
  border: 1px solid #2C2C2C;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  color: #FFFFFF;
  font-size: 28rpx;

  &.flex-1 {
    flex: 1;
  }
}

.code-row {
  display: flex;
  gap: 16rpx;
  align-items: center;

  .code-btn {
    background-color: #2C2C2C;
    color: #C1F80A;
    font-size: 24rpx;
    font-weight: 600;
    padding: 20rpx 24rpx;
    border-radius: 12rpx;
    line-height: 1.2;
  }
}

.otp-hint {
  font-size: 24rpx;
  color: #C1F80A;
  font-weight: 600;
}

.submit-btn {
  background-color: #C1F80A;
  color: #121212;
  font-weight: 700;
  font-size: 28rpx;
  border-radius: 40rpx;
  padding: 20rpx 0;
  text-align: center;
  line-height: 1.2;
}
</style>
