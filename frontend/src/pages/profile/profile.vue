<template>
  <view class="container">
    <!-- Profile Card (Header) -->
    <view class="profile-card">
      <view class="avatar-container">
        <image class="avatar" :src="userInfo.avatarUrl" mode="aspectFill" />
        <view class="level-badge" v-if="userInfo.isLoggedIn">
          <text class="level-text">{{ userInfo.skillLevel.toFixed(1) }}</text>
        </view>
      </view>

      <view class="user-meta" v-if="userInfo.isLoggedIn">
        <text class="nickname">{{ userInfo.nickname }}</text>
        <view class="wechat-bind-badge">
          <text class="wechat-icon">🟢</text>
          <text class="wechat-text">WeChat Linked</text>
        </view>
      </view>
      
      <view class="login-prompt" v-else>
        <text class="prompt-title">Welcome to PickleMate</text>
        <text class="prompt-subtitle">Log in to track check-ins and find matches</text>
        <button class="wechat-login-btn" @tap="handleWeChatLogin">
          <text class="btn-wechat-logo">💬</text>
          <text class="btn-text">WeChat Quick Login</text>
        </button>
      </view>
    </view>

    <!-- Stats Panel -->
    <view class="stats-panel" v-if="userInfo.isLoggedIn">
      <view class="stat-box">
        <text class="stat-value">{{ userInfo.gamesPlayed }}</text>
        <text class="stat-label">Check-ins</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-box">
        <text class="stat-value">{{ userInfo.favoriteCourtsCount }}</text>
        <text class="stat-label">Favorites</text>
      </view>
      <view class="stat-divider"></view>
      <view class="stat-box">
        <text class="stat-value">{{ userInfo.createdSessionsCount }}</text>
        <text class="stat-label">Hosted</text>
      </view>
    </view>

    <!-- Player Profile Details -->
    <view class="section-card" v-if="userInfo.isLoggedIn">
      <text class="section-title">Player Profile</text>
      
      <view class="profile-row">
        <text class="row-label">Skill Level</text>
        <picker 
          mode="selector" 
          :range="skillLevels" 
          :value="skillIndex" 
          @change="onSkillChange"
        >
          <view class="picker-row">
            <text class="row-value">{{ skillLevels[skillIndex] }}</text>
            <text class="arrow">▶</text>
          </view>
        </picker>
      </view>

      <view class="profile-row">
        <text class="row-label">Preferred Net Type</text>
        <text class="row-value">Permanent & Portable</text>
      </view>

      <view class="profile-row">
        <text class="row-label">Favorite Court</text>
        <text class="row-value highlighted">Olympic Forest Park</text>
      </view>

      <view class="profile-row">
        <text class="row-label">Preferred Playtime</text>
        <text class="row-value">Weekday Evenings, Weekends</text>
      </view>
    </view>

    <!-- Checked-in Sessions -->
    <view class="section-card" v-if="userInfo.isLoggedIn">
      <view class="section-header-row">
        <text class="section-title">My Match Schedule</text>
        <text class="section-action">View All</text>
      </view>

      <view class="empty-schedule" v-if="upcomingSessions.length === 0">
        <text class="empty-text">No upcoming games scheduled.</text>
        <text class="empty-subtext" @tap="findMatches">Find matches on nearby courts</text>
      </view>

      <view class="schedule-list" v-else>
        <view 
          v-for="session in upcomingSessions" 
          :key="session.id" 
          class="schedule-item"
        >
          <view class="schedule-indicator"></view>
          <view class="schedule-details">
            <text class="schedule-title">{{ session.title }}</text>
            <text class="schedule-court">{{ session.courtName }}</text>
            <text class="schedule-time">📅 {{ session.time }}</text>
          </view>
          <view class="schedule-players-badge">
            <text class="players-count">{{ session.playersCount }}/4</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Account Settings & Logout -->
    <view class="settings-list" v-if="userInfo.isLoggedIn">
      <view class="settings-item">
        <text class="settings-text">Notification Settings</text>
        <text class="arrow">▶</text>
      </view>
      <view class="settings-item">
        <text class="settings-text">About PickleMate</text>
        <text class="arrow">▶</text>
      </view>
      <button class="logout-btn" @tap="handleLogout">Log Out</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface UserProfile {
  isLoggedIn: boolean;
  nickname: string;
  avatarUrl: string;
  skillLevel: number;
  gamesPlayed: number;
  favoriteCourtsCount: number;
  createdSessionsCount: number;
}

interface UpcomingSession {
  id: string;
  title: string;
  courtName: string;
  time: string;
  playersCount: number;
}

const skillLevels = ['2.0 (Beginner)', '2.5 (Advanced Beginner)', '3.0 (Intermediate)', '3.5 (Solid Intermediate)', '4.0 (Advanced)', '4.5+ (Pro/Expert)'];
const skillIndex = ref(3); // 3.5

const userInfo = ref<UserProfile>({
  isLoggedIn: false,
  nickname: 'PicklePro_99',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  skillLevel: 3.5,
  gamesPlayed: 14,
  favoriteCourtsCount: 3,
  createdSessionsCount: 2
});

const upcomingSessions = ref<UpcomingSession[]>([
  {
    id: 's1',
    title: 'Doubles Match (Rec Play)',
    courtName: 'Olympic Park Court 2',
    time: 'Tomorrow, 5:00 PM - 7:00 PM',
    playersCount: 4
  },
  {
    id: 's2',
    title: 'Drills & Practice Session',
    courtName: 'Indoor Paddle Court Center',
    time: 'Saturday, 10:00 AM - 12:00 PM',
    playersCount: 2
  }
]);

const handleWeChatLogin = () => {
  uni.showLoading({
    title: 'Connecting WeChat...'
  });
  
  // Simulate WeChat Auth callback
  setTimeout(() => {
    uni.hideLoading();
    userInfo.value.isLoggedIn = true;
    uni.showToast({
      title: 'Welcome, PicklePro_99!',
      icon: 'success'
    });
  }, 1000);
};

const handleLogout = () => {
  uni.showModal({
    title: 'Log Out',
    content: 'Are you sure you want to log out?',
    success: (res) => {
      if (res.confirm) {
        userInfo.value.isLoggedIn = false;
        uni.showToast({
          title: 'Logged out successfully',
          icon: 'none'
        });
      }
    }
  });
};

const onSkillChange = (e: any) => {
  skillIndex.value = e.detail.value;
  const match = skillLevels[skillIndex.value].match(/^([0-9.]+)/);
  if (match) {
    userInfo.value.skillLevel = parseFloat(match[1]);
  }
  uni.showToast({
    title: `Updated level to ${userInfo.value.skillLevel}`,
    icon: 'none'
  });
};

const findMatches = () => {
  uni.switchTab({
    url: '/pages/index/index'
  });
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
  margin-bottom: 30rpx;
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
  gap: 12rpx;
  
  .nickname {
    font-size: 38rpx;
    font-weight: 700;
  }
  
  .wechat-bind-badge {
    display: flex;
    align-items: center;
    gap: 8rpx;
    background-color: rgba(9, 187, 7, 0.1);
    padding: 6rpx 14rpx;
    border-radius: 20rpx;
    border: 1px solid rgba(9, 187, 7, 0.2);
    align-self: flex-start;
    
    .wechat-icon {
      font-size: 16rpx;
    }
    
    .wechat-text {
      color: #09BB07;
      font-size: 20rpx;
      font-weight: 600;
    }
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
    margin-bottom: 30rpx;
  }
  
  .wechat-login-btn {
    width: 100%;
    background-color: #09BB07;
    color: #FFFFFF;
    font-size: 26rpx;
    font-weight: 700;
    border-radius: 40rpx;
    padding: 15rpx 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10rpx;
    border: none;
    line-height: 1.5;
    
    .btn-wechat-logo {
      font-size: 32rpx;
    }
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
  letter-spacing: 0.5rpx;
  border-left: 6rpx solid #C1F80A;
  padding-left: 15rpx;
}

.section-action {
  font-size: 22rpx;
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
  padding: 40rpx 0;
  
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
  height: 80rpx;
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

.settings-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #1E1E1E;
  border-radius: 16rpx;
  padding: 25rpx 30rpx;
  border: 1px solid #2C2C2C;
  
  .settings-text {
    font-size: 26rpx;
    color: #FFFFFF;
    font-weight: 500;
  }
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
  margin-top: 30rpx;
  line-height: 1.5;
}
</style>
