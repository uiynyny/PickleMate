<template>
  <view class="container" v-if="session">
    <!-- Header -->
    <view class="header">
      <view class="title-row">
        <text class="title">{{ session.title }}</text>
        <view :class="['status-badge', sessionStatusClass]">
          <text>{{ sessionStatusText }}</text>
        </view>
      </view>
      <text class="subtitle">{{ formatDateTime(session.playTime) }}</text>
    </view>

    <!-- Court Info Card -->
    <view class="card" @tap="goToCourt">
      <view class="card-row">
        <text class="card-label">📍 球场</text>
        <text class="card-value">{{ session.court?.name || '未知球场' }} ▶</text>
      </view>
      <view class="card-row">
        <text class="card-label">📮 地址</text>
        <text class="card-value muted">{{ session.court?.address || '' }}</text>
      </view>
    </view>

    <!-- Session Info Card -->
    <view class="card">
      <view class="card-row">
        <text class="card-label">👤 组织者</text>
        <view class="host-info">
          <text class="card-value">{{ session.host?.nickname || '未知' }}</text>
          <text v-if="session.host?.skillLevel" class="skill-badge">DUPR {{ session.host.skillLevel }}</text>
          <view
            v-if="session.host?.id && session.host.id !== currentUserId"
            class="dm-mini-btn"
            @tap="startDmWithUser(session.host)"
          >
            <text>私信</text>
          </view>
        </view>
      </view>
      <view class="card-row">
        <text class="card-label">🎯 技能要求</text>
        <text class="card-value">DUPR {{ session.skillMin }} - {{ session.skillMax }}</text>
      </view>
      <view class="card-row">
        <text class="card-label">👥 参与人数</text>
        <text class="card-value highlight">{{ session.playerCount }} / {{ session.maxPlayers }}</text>
      </view>
      <view class="card-row" v-if="session.description">
        <text class="card-label">📝 描述</text>
        <text class="card-value muted">{{ session.description }}</text>
      </view>
    </view>

    <!-- Players List -->
    <view class="card">
      <text class="section-title">已加入的球友 ({{ session.playerCount }})</text>
      <view v-if="session.players && session.players.length > 0" class="player-list">
        <view v-for="player in session.players" :key="player.id" class="player-item">
          <image class="player-avatar" :src="player.avatarUrl || defaultAvatar" mode="aspectFill" />
          <view class="player-info">
            <text class="player-name">{{ player.nickname || '匿名球友' }}</text>
            <text v-if="player.skillLevel" class="player-skill">DUPR {{ player.skillLevel }}</text>
          </view>
          <view v-if="player.id === session.hostId" class="host-tag">
            <text>Host</text>
          </view>
          <view
            v-if="player.id !== currentUserId"
            class="dm-mini-btn"
            @tap="startDmWithUser(player)"
          >
            <text>💬 私信</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-section">
        <text class="empty-text">还没有球友加入，快来抢占席位！</text>
      </view>
    </view>

    <!-- Action Buttons -->
    <view class="actions">
      <button class="action-btn chat-btn" @tap="openSessionChat">
        💬 进入球局群聊
      </button>

      <!-- Join button (when not host and not joined) -->
      <button v-if="!isHost && !isJoined && !session.isFull" class="action-btn join-btn" @tap="handleJoin">
        🎾 加入球局
      </button>

      <!-- Joined but not host: show leave button -->
      <button v-if="isJoined && !isHost" class="action-btn leave-btn" @tap="handleLeave">
        退出球局
      </button>

      <!-- Host only: invite and cancel -->
      <template v-if="isHost">
        <button class="action-btn invite-btn" @tap="handleInvite">＋ 邀请匹配球友</button>
        <button class="action-btn cancel-btn" @tap="handleCancel">取消球局</button>
      </template>

      <!-- Full session message -->
      <view v-if="session.isFull && !isJoined && !isHost" class="full-badge">
        <text>该球局已满员</text>
      </view>
    </view>

    <!-- Skill-Matched Recommendations & Search Invite Modal -->
    <view v-if="showInviteModal" class="modal-backdrop">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">🎯 邀请匹配球友</text>
          <text class="modal-close" @tap="showInviteModal = false">✕</text>
        </view>
        <view class="modal-body">
          <text class="modal-hint">为您推荐符合 DUPR {{ session.skillMin }}-{{ session.skillMax }} 的活跃球友：</text>
          <view class="search-row">
            <input
              class="modal-input"
              type="text"
              placeholder="按昵称搜索球友..."
              v-model="searchKeyword"
              @confirm="loadRecommendations"
            />
            <button class="search-btn" @tap="loadRecommendations">搜索</button>
          </view>

          <scroll-view class="rec-scroll" scroll-y>
            <view v-if="recommendations.length === 0" class="empty-rec">
              <text>暂无可推荐的球友</text>
            </view>
            <view
              v-for="candidate in recommendations"
              :key="candidate.id"
              class="rec-item"
            >
              <image class="rec-avatar" :src="candidate.avatarUrl || defaultAvatar" mode="aspectFill" />
              <view class="rec-info">
                <text class="rec-name">{{ candidate.nickname || '球友' }}</text>
                <text class="rec-skill">DUPR {{ candidate.skillLevel ?? '未评级' }}</text>
              </view>
              <button
                class="rec-invite-btn"
                :disabled="invitedUserIds.includes(candidate.id)"
                @tap="sendInviteToUser(candidate.id)"
              >
                {{ invitedUserIds.includes(candidate.id) ? '已邀请' : '邀请' }}
              </button>
            </view>
          </scroll-view>
        </view>
      </view>
    </view>
  </view>

  <!-- Loading -->
  <view v-else class="loading">
    <text>加载中...</text>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiRequest } from '../../services/api';
import { useChatStore } from '../../stores/chat';

const defaultAvatar = 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback';
const chatStore = useChatStore();

const sessionId = ref('');
const session = ref<any>(null);
const currentUserId = ref('');

const showInviteModal = ref(false);
const searchKeyword = ref('');
const recommendations = ref<any[]>([]);
const invitedUserIds = ref<string[]>([]);

const isHost = computed(() => {
  return session.value && currentUserId.value === session.value.hostId;
});

const isJoined = computed(() => {
  if (!session.value?.players) return false;
  return session.value.players.some((p: any) => p.id === currentUserId.value);
});

const sessionStatusClass = computed(() => {
  return session.value?.isFull ? 'full' : 'open';
});

const sessionStatusText = computed(() => {
  if (!session.value) return '';
  if (session.value.isFull) return '已满员';
  return '可加入';
});

onMounted(() => {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as any;
  if (page && page.options && page.options.id) {
    sessionId.value = page.options.id;
    fetchSession();
  }

  const userStr = uni.getStorageSync('user');
  if (userStr) {
    try {
      currentUserId.value = JSON.parse(userStr).id;
    } catch {}
  }
});

const fetchSession = async () => {
  const res = await apiRequest({
    url: `/play-sessions/${sessionId.value}`,
    method: 'GET',
    auth: false,
  });
  if (res.statusCode === 200) {
    session.value = res.data;
  } else {
    uni.showToast({ title: '加载失败', icon: 'none' });
  }
};

const formatDateTime = (isoStr: string) => {
  const d = new Date(isoStr);
  const options: any = { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleDateString('zh-CN', options);
};

const goToCourt = () => {
  if (session.value?.court?.id) {
    uni.navigateTo({ url: `/pages/court/detail?id=${session.value.court.id}` });
  }
};

const openSessionChat = async () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }
  const res = await chatStore.openSessionRoom(sessionId.value);
  if ((res.statusCode === 200 || res.statusCode === 201) && res.data?.id) {
    const title = encodeURIComponent(res.data.name || `${session.value?.title || '球局'} 群聊`);
    uni.navigateTo({
      url: `/pages/chat/room?roomId=${res.data.id}&title=${title}`,
    });
  } else {
    uni.showToast({ title: (res.data as any)?.message || '无法打开群聊', icon: 'none' });
  }
};

const startDmWithUser = async (targetUser: any) => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先绑定手机号激活账号', icon: 'none' });
    return;
  }
  const res = await chatStore.openDm(targetUser.id);
  if ((res.statusCode === 200 || res.statusCode === 201) && res.data?.id) {
    const title = encodeURIComponent(`与 ${targetUser.nickname || '球友'} 的私信`);
    uni.navigateTo({
      url: `/pages/chat/room?dmId=${res.data.id}&title=${title}`,
    });
  } else {
    uni.showToast({ title: (res.data as any)?.message || '无法发起私信', icon: 'none' });
  }
};

const handleJoin = async () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    uni.showToast({ title: '请先登录', icon: 'none' });
    return;
  }

  const res = await apiRequest({
    url: `/play-sessions/${sessionId.value}/join`,
    method: 'POST',
  });
  if (res.statusCode === 201) {
    uni.showToast({ title: '已加入球局！', icon: 'success' });
    fetchSession();
  } else {
    uni.showToast({ title: (res.data as any)?.message || '加入失败', icon: 'none' });
  }
};

const handleLeave = () => {
  const token = uni.getStorageSync('token');
  if (!token) return;
  
  uni.showModal({
    title: '退出球局',
    content: '确定要退出该球局吗？',
    success: async (res) => {
      if (res.confirm) {
        const apiRes = await apiRequest({
          url: `/play-sessions/${sessionId.value}/leave`,
          method: 'POST',
        });
        if (apiRes.statusCode === 201) {
          uni.showToast({ title: '已退出球局', icon: 'success' });
          fetchSession();
        } else {
          uni.showToast({ title: (apiRes.data as any)?.message || '退出失败', icon: 'none' });
        }
      }
    },
  });
};

const handleCancel = () => {
  const token = uni.getStorageSync('token');
  if (!token) return;

  uni.showModal({
    title: '取消球局',
    content: '确定要取消该球局吗？此操作不可撤销。',
    success: async (res) => {
      if (res.confirm) {
        const apiRes = await apiRequest({
          url: `/play-sessions/${sessionId.value}`,
          method: 'DELETE',
        });
        if (apiRes.statusCode === 200) {
          uni.showToast({ title: '球局已取消', icon: 'success' });
          uni.navigateBack();
        } else {
          uni.showToast({ title: (apiRes.data as any)?.message || '取消失败', icon: 'none' });
        }
      }
    },
  });
};

const handleInvite = () => {
  showInviteModal.value = true;
  searchKeyword.value = '';
  loadRecommendations();
};

const loadRecommendations = async () => {
  const q = searchKeyword.value.trim()
    ? `?keyword=${encodeURIComponent(searchKeyword.value.trim())}`
    : '';
  const res = await apiRequest<any[]>({
    url: `/play-sessions/${sessionId.value}/recommendations${q}`,
    method: 'GET',
  });
  if (res.statusCode === 200 && Array.isArray(res.data)) {
    recommendations.value = res.data;
  }
};

const sendInviteToUser = async (recipientId: string) => {
  const res = await apiRequest({
    url: `/play-sessions/${sessionId.value}/invite`,
    method: 'POST',
    data: { recipientId },
  });
  if (res.statusCode === 201) {
    invitedUserIds.value.push(recipientId);
    uni.showToast({ title: '邀请已发送！', icon: 'success' });
  } else {
    uni.showToast({ title: (res.data as any)?.message || '邀请失败', icon: 'none' });
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
  margin-bottom: 30rpx;
  
  .title-row {
    display: flex;
    align-items: center;
    gap: 15rpx;
    margin-bottom: 10rpx;
    
    .title {
      font-size: 40rpx;
      font-weight: 800;
      flex: 1;
    }
  }
  
  .subtitle {
    font-size: 24rpx;
    color: #C1F80A;
    font-weight: 600;
  }
}

.status-badge {
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 20rpx;
  font-weight: 700;
  
  &.open {
    background-color: rgba(193, 248, 10, 0.1);
    color: #C1F80A;
    border: 1px solid rgba(193, 248, 10, 0.3);
  }
  
  &.full {
    background-color: rgba(255, 59, 48, 0.1);
    color: #FF3B30;
    border: 1px solid rgba(255, 59, 48, 0.3);
  }
}

.card {
  background-color: #1E1E1E;
  border-radius: 16rpx;
  padding: 25rpx;
  margin-bottom: 20rpx;
  border: 1px solid #2C2C2C;
}

.card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
  border-bottom: 1px solid #2C2C2C;
  
  &:last-child {
    border-bottom: none;
  }
  
  .card-label {
    font-size: 26rpx;
    color: #8E8E93;
  }
  
  .card-value {
    font-size: 26rpx;
    color: #FFFFFF;
    font-weight: 500;
    
    &.muted {
      color: #8E8E93;
      text-align: right;
      max-width: 60%;
    }
    
    &.highlight {
      color: #C1F80A;
      font-weight: 700;
    }
  }
}

.host-info {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.skill-badge {
  background-color: #FFC107;
  color: #121212;
  font-size: 18rpx;
  font-weight: 700;
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}

.dm-mini-btn {
  background-color: rgba(0, 122, 255, 0.15);
  border: 1px solid rgba(0, 122, 255, 0.4);
  padding: 6rpx 14rpx;
  border-radius: 20rpx;

  text {
    font-size: 20rpx;
    color: #4DA3FF;
    font-weight: 600;
  }
}

.section-title {
  font-size: 28rpx;
  font-weight: 700;
  margin-bottom: 20rpx;
  display: block;
}

.player-list {
  display: flex;
  flex-direction: column;
  gap: 15rpx;
}

.player-item {
  display: flex;
  align-items: center;
  gap: 15rpx;
  
  .player-avatar {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background-color: #2C2C2C;
  }
  
  .player-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4rpx;
    
    .player-name {
      font-size: 26rpx;
      font-weight: 600;
    }
    
    .player-skill {
      font-size: 20rpx;
      color: #FFC107;
      font-weight: 600;
    }
  }
  
  .host-tag {
    background-color: rgba(193, 248, 10, 0.1);
    color: #C1F80A;
    font-size: 18rpx;
    font-weight: 700;
    padding: 4rpx 10rpx;
    border-radius: 6rpx;
    border: 1px solid rgba(193, 248, 10, 0.3);
  }
}

.empty-section {
  padding: 30rpx 0;
  text-align: center;
  
  .empty-text {
    color: #666666;
    font-size: 24rpx;
  }
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 10rpx;
}

.action-btn {
  font-size: 28rpx;
  font-weight: 700;
  border-radius: 40rpx;
  padding: 22rpx 0;
  line-height: 1.2;
  border: none;

  &.chat-btn {
    background-color: #1E1E1E;
    color: #C1F80A;
    border: 1px solid #C1F80A;
  }
  
  &.join-btn {
    background-color: #C1F80A;
    color: #121212;
  }
  
  &.leave-btn {
    background-color: #FF9500;
    color: #FFFFFF;
  }
  
  &.invite-btn {
    background-color: #007AFF;
    color: #FFFFFF;
  }
  
  &.cancel-btn {
    background-color: #FF3B30;
    color: #FFFFFF;
  }
}

.full-badge {
  text-align: center;
  padding: 20rpx;
  background-color: #2C2C2C;
  border-radius: 12rpx;
  color: #8E8E93;
  font-size: 26rpx;
  font-weight: 600;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  color: #8E8E93;
  font-size: 28rpx;
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

.modal-hint {
  font-size: 24rpx;
  color: #8E8E93;
}

.search-row {
  display: flex;
  gap: 15rpx;
  align-items: center;

  .modal-input {
    flex: 1;
    background-color: #121212;
    border: 1px solid #2C2C2C;
    border-radius: 12rpx;
    padding: 16rpx 20rpx;
    color: #FFFFFF;
    font-size: 26rpx;
  }

  .search-btn {
    background-color: #C1F80A;
    color: #121212;
    font-size: 24rpx;
    font-weight: 700;
    padding: 16rpx 26rpx;
    border-radius: 12rpx;
    line-height: 1.2;
  }
}

.rec-scroll {
  max-height: 450rpx;
}

.empty-rec {
  padding: 40rpx 0;
  text-align: center;
  color: #666666;
  font-size: 24rpx;
}

.rec-item {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1px solid #2C2C2C;

  .rec-avatar {
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background-color: #2C2C2C;
  }

  .rec-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4rpx;

    .rec-name {
      font-size: 26rpx;
      font-weight: 600;
      color: #FFFFFF;
    }

    .rec-skill {
      font-size: 22rpx;
      color: #FFC107;
    }
  }

  .rec-invite-btn {
    background-color: #007AFF;
    color: #FFFFFF;
    font-size: 22rpx;
    font-weight: 700;
    padding: 10rpx 24rpx;
    border-radius: 24rpx;
    line-height: 1.2;

    &[disabled] {
      background-color: #2C2C2C;
      color: #8E8E93;
    }
  }
}
</style>
