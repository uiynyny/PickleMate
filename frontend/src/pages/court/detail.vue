<template>
  <view class="container" v-if="court">
    <!-- Cover Image -->
    <image class="cover-image" src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80" mode="aspectFill" />
    
    <!-- Court Header Info -->
    <view class="info-section">
      <view class="title-row">
        <text class="title">{{ court.name }}</text>
        <view class="verified-badge" v-if="court.isVerified">
          <text class="verified-icon">✓</text>
          <text>Verified</text>
        </view>
      </view>
      <text class="address">{{ court.address }}</text>
      
      <view class="tags-row">
        <text v-if="court.isIndoor" class="tag indoor">Indoor</text>
        <text v-else class="tag outdoor">Outdoor</text>
        <text v-if="court.hasLights" class="tag lights">💡 Lights</text>
        <text class="tag common">{{ court.numCourts }} Courts</text>
        <text class="tag common">{{ court.netType }}</text>
        <text class="tag common">{{ court.surfaceType }}</text>
      </view>
      
      <!-- Action Buttons -->
      <view class="actions-row">
        <button class="action-btn checkin-btn" @tap="showCheckInModal = true">
          📍 立即打卡
        </button>
        <button class="action-btn session-btn" @tap="comingSoon">
          🎾 发起球局
        </button>
      </view>
    </view>

    <!-- Tabs -->
    <view class="tabs">
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'checkin' }" 
        @tap="switchTab('checkin')"
      >
        <text>活跃打卡 ({{ checkIns.length }})</text>
      </view>
      <view 
        class="tab-item" 
        :class="{ active: currentTab === 'bulletin' }" 
        @tap="switchTab('bulletin')"
      >
        <text>留言板 ({{ posts.length }})</text>
      </view>
    </view>

    <!-- Tab Contents -->
    <scroll-view class="scroll-content" scroll-y>
      
      <!-- Check-In Tab -->
      <view v-if="currentTab === 'checkin'" class="tab-pane checkin-pane">
        <view v-if="checkIns.length === 0" class="empty-state">
          <text>目前没有球友打卡，快来做第一个！</text>
        </view>
        <view v-for="item in checkIns" :key="item.id" class="checkin-item">
          <image class="avatar" :src="item.user?.avatarUrl || defaultAvatar" mode="aspectFill" />
          <view class="user-info">
            <text class="nickname">{{ item.user?.nickname || '匿名球友' }}</text>
            <view class="dupr-badge" v-if="item.user?.skillLevel">
              DUPR {{ item.user.skillLevel }}
            </view>
          </view>
          <view class="time-info">
            <text class="time-text">{{ formatTime(item.startTime) }} - {{ formatTime(item.endTime) }}</text>
          </view>
        </view>
      </view>

      <!-- Bulletin Board Tab -->
      <view v-if="currentTab === 'bulletin'" class="tab-pane bulletin-pane">
        <view v-if="posts.length === 0" class="empty-state">
          <text>还没有留言，发一句“这里有人打球吗？”</text>
        </view>
        <view v-for="post in posts" :key="post.id" class="post-item">
          <image class="avatar" :src="post.user?.avatarUrl || defaultAvatar" mode="aspectFill" />
          <view class="post-content">
            <view class="post-header">
              <text class="nickname">{{ post.user?.nickname || '匿名球友' }}</text>
              <text class="post-time">{{ formatRelativeTime(post.created_at) }}</text>
            </view>
            <text class="post-text">{{ post.content }}</text>
          </view>
        </view>
      </view>

    </scroll-view>

    <!-- Bottom Input for Bulletin -->
    <view v-if="currentTab === 'bulletin'" class="chat-input-area">
      <input 
        class="chat-input" 
        type="text" 
        placeholder="写下你想对大家说的话..." 
        v-model="postContent"
        @confirm="submitPost"
        confirm-type="send"
      />
      <button class="send-btn" @tap="submitPost">发送</button>
    </view>

    <!-- Check-In Modal -->
    <view v-if="showCheckInModal" class="modal-backdrop">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">📍 签到打卡</text>
          <text class="modal-close" @tap="showCheckInModal = false">✕</text>
        </view>
        <view class="modal-body">
          <text class="modal-desc">声明您即将在此球场活动的时间，方便附近球友找您约球。</text>
          
          <view class="input-group-label">预计活动时长</view>
          <radio-group class="radio-row" @change="checkInDuration = parseInt($event.detail.value)">
            <label class="radio-label">
              <radio value="1" checked color="#C1F80A" /> 1 小时
            </label>
            <label class="radio-label">
              <radio value="2" color="#C1F80A" /> 2 小时
            </label>
            <label class="radio-label">
              <radio value="3" color="#C1F80A" /> 3 小时
            </label>
          </radio-group>

          <button class="submit-btn" @tap="submitCheckIn">确认签到</button>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const BASE_URL = 'http://localhost:3000';
const defaultAvatar = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback';

const courtId = ref('');
const court = ref<any>(null);
const currentTab = ref('checkin');

const checkIns = ref<any[]>([]);
const posts = ref<any[]>([]);

// UI States
const showCheckInModal = ref(false);
const checkInDuration = ref(1);
const postContent = ref('');

onMounted(() => {
  // get courtId from page query
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as any;
  if (page && page.options && page.options.id) {
    courtId.value = page.options.id;
    fetchCourtDetail();
    fetchCheckIns();
    fetchPosts();
  }
});

const switchTab = (tab: string) => {
  currentTab.value = tab;
};

const comingSoon = () => {
  uni.showToast({ title: '球局功能即将上线', icon: 'none' });
};

// ================= Data Fetching =================
const fetchCourtDetail = () => {
  uni.request({
    url: `${BASE_URL}/courts/${courtId.value}`,
    method: 'GET',
    success: (res: any) => {
      if (res.statusCode === 200) {
        court.value = res.data;
      } else {
        uni.showToast({ title: '球场加载失败', icon: 'none' });
      }
    }
  });
};

const fetchCheckIns = () => {
  uni.request({
    url: `${BASE_URL}/courts/${courtId.value}/checkins`,
    method: 'GET',
    success: (res: any) => {
      if (res.statusCode === 200) {
        checkIns.value = res.data;
      }
    }
  });
};

const fetchPosts = () => {
  uni.request({
    url: `${BASE_URL}/courts/${courtId.value}/posts`,
    method: 'GET',
    success: (res: any) => {
      if (res.statusCode === 200) {
        posts.value = res.data;
      }
    }
  });
};

// ================= Interactivity =================
const submitCheckIn = () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先绑定手机号（激活用户）', icon: 'none' });
    showCheckInModal.value = false;
    return;
  }

  const start = new Date();
  const end = new Date(start.getTime() + checkInDuration.value * 60 * 60 * 1000);

  uni.request({
    url: `${BASE_URL}/courts/${courtId.value}/checkin`,
    method: 'POST',
    header: {
      Authorization: `Bearer ${token}`
    },
    data: {
      startTime: start.toISOString(),
      endTime: end.toISOString()
    },
    success: (res: any) => {
      if (res.statusCode === 201) {
        uni.showToast({ title: '签到成功！', icon: 'success' });
        showCheckInModal.value = false;
        fetchCheckIns();
      } else {
        uni.showToast({ title: res.data.message || '签到失败', icon: 'none' });
      }
    }
  });
};

const submitPost = () => {
  if (!postContent.value.trim()) return;

  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先绑定手机号', icon: 'none' });
    return;
  }

  uni.request({
    url: `${BASE_URL}/courts/${courtId.value}/posts`,
    method: 'POST',
    header: {
      Authorization: `Bearer ${token}`
    },
    data: {
      content: postContent.value
    },
    success: (res: any) => {
      if (res.statusCode === 201) {
        postContent.value = ''; // clear input
        fetchPosts(); // refresh list
      } else {
        uni.showToast({ title: res.data.message || '发送失败', icon: 'none' });
      }
    }
  });
};

// ================= Utilities =================
const formatTime = (isoStr: string) => {
  const date = new Date(isoStr);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
};

const formatRelativeTime = (isoStr: string) => {
  const diff = Date.now() - new Date(isoStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
};
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #121212;
  color: #FFFFFF;
}

.cover-image {
  width: 100%;
  height: 350rpx;
}

.info-section {
  padding: 30rpx;
  background-color: #1E1E1E;
  border-bottom: 1px solid #2C2C2C;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 10rpx;
  
  .title {
    font-size: 40rpx;
    font-weight: 800;
  }
}

.verified-badge {
  background-color: rgba(193, 248, 10, 0.1);
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  gap: 6rpx;
  border: 1px solid rgba(193, 248, 10, 0.3);
  
  text {
    font-size: 20rpx;
    color: #C1F80A;
    font-weight: 700;
  }
}

.address {
  font-size: 26rpx;
  color: #8E8E93;
  margin-bottom: 20rpx;
  display: block;
}

.tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 30rpx;
  
  .tag {
    font-size: 22rpx;
    font-weight: 600;
    padding: 6rpx 16rpx;
    border-radius: 8rpx;
    
    &.indoor {
      background-color: rgba(0, 122, 255, 0.1);
      color: #007AFF;
    }
    &.outdoor {
      background-color: rgba(255, 149, 0, 0.1);
      color: #FF9500;
    }
    &.lights {
      background-color: rgba(193, 248, 10, 0.1);
      color: #C1F80A;
    }
    &.common {
      background-color: #2C2C2C;
      color: #8E8E93;
    }
  }
}

.actions-row {
  display: flex;
  gap: 20rpx;
  
  .action-btn {
    flex: 1;
    font-size: 28rpx;
    font-weight: 700;
    border-radius: 12rpx;
    padding: 16rpx 0;
    display: flex;
    justify-content: center;
    align-items: center;
    line-height: 1.2;
    border: none;
    
    &.checkin-btn {
      background-color: #C1F80A;
      color: #121212;
    }
    
    &.session-btn {
      background-color: #2C2C2C;
      color: #FFFFFF;
    }
  }
}

.tabs {
  display: flex;
  background-color: #1E1E1E;
  border-bottom: 1px solid #2C2C2C;
  
  .tab-item {
    flex: 1;
    text-align: center;
    padding: 24rpx 0;
    
    text {
      font-size: 28rpx;
      font-weight: 600;
      color: #8E8E93;
    }
    
    &.active {
      border-bottom: 4rpx solid #C1F80A;
      
      text {
        color: #C1F80A;
      }
    }
  }
}

.scroll-content {
  flex: 1;
  overflow: hidden;
  background-color: #121212;
}

.empty-state {
  padding: 60rpx 30rpx;
  text-align: center;
  
  text {
    font-size: 26rpx;
    color: #666666;
  }
}

.tab-pane {
  padding: 20rpx;
}

/* Checkin Items */
.checkin-item {
  display: flex;
  align-items: center;
  background-color: #1E1E1E;
  padding: 20rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  border: 1px solid #2C2C2C;
  
  .avatar {
    width: 80rpx;
    height: 80rpx;
    border-radius: 50%;
    margin-right: 20rpx;
    background-color: #2C2C2C;
  }
  
  .user-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8rpx;
    
    .nickname {
      font-size: 28rpx;
      font-weight: 700;
      color: #FFFFFF;
    }
    
    .dupr-badge {
      align-self: flex-start;
      font-size: 20rpx;
      color: #121212;
      background-color: #FFC107;
      padding: 4rpx 10rpx;
      border-radius: 6rpx;
      font-weight: 700;
    }
  }
  
  .time-info {
    .time-text {
      font-size: 24rpx;
      color: #C1F80A;
      font-weight: 600;
    }
  }
}

/* Post Items */
.post-item {
  display: flex;
  background-color: #1E1E1E;
  padding: 20rpx;
  border-radius: 16rpx;
  margin-bottom: 20rpx;
  border: 1px solid #2C2C2C;
  
  .avatar {
    width: 70rpx;
    height: 70rpx;
    border-radius: 50%;
    margin-right: 20rpx;
    background-color: #2C2C2C;
  }
  
  .post-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    
    .post-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10rpx;
      
      .nickname {
        font-size: 26rpx;
        font-weight: 700;
        color: #8E8E93;
      }
      
      .post-time {
        font-size: 22rpx;
        color: #666666;
      }
    }
    
    .post-text {
      font-size: 28rpx;
      color: #FFFFFF;
      line-height: 1.5;
    }
  }
}

/* Chat Input Area */
.chat-input-area {
  padding: 20rpx 30rpx 40rpx 30rpx;
  background-color: #1E1E1E;
  border-top: 1px solid #2C2C2C;
  display: flex;
  align-items: center;
  gap: 20rpx;
  
  .chat-input {
    flex: 1;
    background-color: #121212;
    border: 1px solid #2C2C2C;
    border-radius: 40rpx;
    padding: 16rpx 30rpx;
    color: #FFFFFF;
    font-size: 28rpx;
  }
  
  .send-btn {
    background-color: #C1F80A;
    color: #121212;
    font-size: 26rpx;
    font-weight: 700;
    border-radius: 30rpx;
    padding: 0 30rpx;
    height: 70rpx;
    line-height: 70rpx;
    margin: 0;
  }
}

/* Modal Shared Styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
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
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 30rpx;
  border-bottom: 1px solid #2C2C2C;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .modal-title {
    font-size: 34rpx;
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

.modal-desc {
  font-size: 26rpx;
  color: #8E8E93;
  line-height: 1.5;
}

.input-group-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #FFFFFF;
  margin-top: 10rpx;
}

.radio-row {
  display: flex;
  gap: 30rpx;
  flex-wrap: wrap;
  margin-top: 5rpx;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 10rpx;
  color: #8E8E93;
  font-size: 26rpx;
  font-weight: 500;
}

.submit-btn {
  background-color: #C1F80A;
  color: #121212;
  font-weight: 700;
  font-size: 30rpx;
  border-radius: 40rpx;
  padding: 22rpx 0;
  text-align: center;
  margin-top: 20rpx;
  line-height: 1.2;
}
</style>
