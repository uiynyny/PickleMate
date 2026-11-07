<template>
  <view class="container">
    <!-- Header -->
    <view class="header">
      <view class="header-top">
        <text class="title">🎾 球局广场</text>
        <view class="create-shortcut" @tap="goToPickCourt">
          <text>＋ 去球场组局</text>
        </view>
      </view>
      <view class="tab-bar">
        <view
          :class="['tab-item', currentTab === 'upcoming' ? 'active' : '']"
          @tap="switchTab('upcoming')"
        >
          <text>可加入</text>
        </view>
        <view
          :class="['tab-item', currentTab === 'hosted' ? 'active' : '']"
          @tap="switchTab('hosted')"
        >
          <text>我发起的</text>
        </view>
        <view
          :class="['tab-item', currentTab === 'joined' ? 'active' : '']"
          @tap="switchTab('joined')"
        >
          <text>我加入的</text>
        </view>
        <view
          :class="['tab-item', currentTab === 'invites' ? 'active' : '']"
          @tap="switchTab('invites')"
        >
          <text>邀请{{ inviteCount > 0 ? `(${inviteCount})` : '' }}</text>
        </view>
      </view>
    </view>

    <!-- Sessions List -->
    <scroll-view class="scroll-content" scroll-y>
      <view class="session-list">
        <view v-if="sessions.length === 0" class="empty-state">
          <text class="empty-text">{{ emptyMessage }}</text>
        </view>
        <view
          v-for="session in sessions"
          :key="session.inviteId || session.id"
          class="session-card"
          @tap="goToDetail(session.id)"
        >
          <view class="session-top">
            <text class="session-title">{{ session.title }}</text>
            <view v-if="!session.isInvite" :class="['session-status', session.isFull ? 'full' : 'open']">
              <text>{{ session.isFull ? '满员' : `${session.playerCount}/${session.maxPlayers}` }}</text>
            </view>
            <view v-else class="session-status open">
              <text>待处理邀请</text>
            </view>
          </view>
          <view class="session-meta">
            <text>📍 {{ session.court?.name || '未知球场' }}</text>
            <text class="meta-sep">•</text>
            <text>🎯 DUPR {{ session.skillMin }}-{{ session.skillMax }}</text>
          </view>
          <view class="session-bottom">
            <text class="session-time">📅 {{ formatRelativeTime(session.playTime) }}</text>
            <text class="session-host">👤 {{ session.host?.nickname || session.inviterName || '球友' }}</text>
          </view>

          <!-- Inline Invite Actions -->
          <view v-if="session.isInvite && session.inviteId" class="invite-actions" @tap.stop>
            <button
              class="invite-btn accept"
              @tap.stop="respondInvite(session.inviteId, 'ACCEPTED')"
            >
              ✓ 接受并加入
            </button>
            <button
              class="invite-btn decline"
              @tap.stop="respondInvite(session.inviteId, 'DECLINED')"
            >
              ✕ 拒绝
            </button>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { apiRequest } from '../../services/api';

const currentTab = ref('upcoming');
const sessions = ref<any[]>([]);
const inviteCount = ref(0);

const emptyMessage = computed(() => {
  switch (currentTab.value) {
    case 'upcoming': return '暂时没有可加入的球局';
    case 'hosted': return '你还没有发起过球局';
    case 'joined': return '你还没有加入任何球局';
    case 'invites': return '没有待处理的球局邀请';
    default: return '暂无数据';
  }
});

onMounted(() => {
  fetchSessions();
  refreshInviteBadge();
});

onShow(() => {
  fetchSessions();
  refreshInviteBadge();
});

const switchTab = (tab: string) => {
  currentTab.value = tab;
  sessions.value = [];
  fetchSessions();
};

const goToPickCourt = () => {
  uni.switchTab({
    url: '/pages/index/index',
  });
};

const refreshInviteBadge = async () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    inviteCount.value = 0;
    return;
  }
  try {
    const res = await apiRequest<any[]>({
      url: '/play-sessions/invites',
      method: 'GET',
    });
    if (res.statusCode === 200 && Array.isArray(res.data)) {
      inviteCount.value = res.data.length;
    }
  } catch {
    inviteCount.value = 0;
  }
};

const fetchSessions = async () => {
  const token = uni.getStorageSync('token');

  if (currentTab.value === 'upcoming') {
    const res = await apiRequest<any>({
      url: '/play-sessions?page=1&limit=20',
      method: 'GET',
      auth: false,
    });
    if (res.statusCode === 200) {
      sessions.value = res.data?.data || [];
    }
  } else if (currentTab.value === 'hosted') {
    if (!token) { sessions.value = []; return; }
    const res = await apiRequest<any>({
      url: '/play-sessions/hosted/sessions?upcomingOnly=true&page=1&limit=20',
      method: 'GET',
    });
    if (res.statusCode === 200) {
      sessions.value = res.data?.data || [];
    }
  } else if (currentTab.value === 'joined') {
    if (!token) { sessions.value = []; return; }
    const res = await apiRequest<any>({
      url: '/play-sessions/joined/sessions?upcomingOnly=true&page=1&limit=20',
      method: 'GET',
    });
    if (res.statusCode === 200) {
      sessions.value = res.data?.data || [];
    }
  } else if (currentTab.value === 'invites') {
    if (!token) { sessions.value = []; return; }
    const res = await apiRequest<any[]>({
      url: '/play-sessions/invites',
      method: 'GET',
    });
    if (res.statusCode === 200 && Array.isArray(res.data)) {
      inviteCount.value = res.data.length;
      sessions.value = res.data.map((invite: any) => ({
        ...invite.session,
        inviteId: invite.id,
        inviteStatus: invite.status,
        inviterName: invite.sender?.nickname || invite.session?.host?.nickname,
        isInvite: true,
      }));
    }
  }
};

const respondInvite = async (inviteId: string, status: 'ACCEPTED' | 'DECLINED') => {
  const res = await apiRequest<any>({
    url: `/play-sessions/invites/${inviteId}/respond`,
    method: 'POST',
    data: { status },
  });
  if (res.statusCode === 201 || res.statusCode === 200) {
    uni.showToast({
      title: status === 'ACCEPTED' ? '已接受邀请并加入球局！' : '已拒绝邀请',
      icon: status === 'ACCEPTED' ? 'success' : 'none',
    });
    fetchSessions();
    refreshInviteBadge();
  } else {
    uni.showToast({
      title: (res.data as any)?.message || '处理邀请失败',
      icon: 'none',
    });
    fetchSessions();
  }
};

const formatRelativeTime = (isoStr: string) => {
  const d = new Date(isoStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}天后 · ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (hours > 0) return `${hours}小时后`;
  if (hours === 0) return '即将开始';
  return '已开始';
};

const goToDetail = (id: string) => {
  uni.navigateTo({ url: `/pages/play-session/detail?id=${id}` });
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

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 25rpx;
  }
  
  .title {
    font-size: 44rpx;
    font-weight: 800;
    color: #C1F80A;
  }

  .create-shortcut {
    background-color: rgba(193, 248, 10, 0.15);
    border: 1px solid #C1F80A;
    padding: 10rpx 22rpx;
    border-radius: 30rpx;

    text {
      font-size: 24rpx;
      font-weight: 700;
      color: #C1F80A;
    }
  }
}

.tab-bar {
  display: flex;
  background-color: #1E1E1E;
  border-radius: 12rpx;
  padding: 4rpx;
  border: 1px solid #2C2C2C;
}

.tab-item {
  flex: 1;
  text-align: center;
  padding: 14rpx 0;
  border-radius: 10rpx;
  
  text {
    font-size: 24rpx;
    color: #8E8E93;
    font-weight: 600;
  }
  
  &.active {
    background-color: #C1F80A;
    
    text {
      color: #121212;
      font-weight: 700;
    }
  }
}

.scroll-content {
  height: calc(100vh - 220rpx);
}

.session-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 100rpx 0;
  
  .empty-text {
    color: #666666;
    font-size: 26rpx;
  }
}

.session-card {
  background-color: #1E1E1E;
  border-radius: 16rpx;
  padding: 25rpx;
  border: 1px solid #2C2C2C;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.session-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .session-title {
    font-size: 30rpx;
    font-weight: 700;
    flex: 1;
    margin-right: 15rpx;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .session-status {
    font-size: 20rpx;
    font-weight: 700;
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    
    &.open {
      background-color: rgba(193, 248, 10, 0.1);
      color: #C1F80A;
    }
    
    &.full {
      background-color: rgba(255, 59, 48, 0.1);
      color: #FF3B30;
    }
  }
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 10rpx;
  
  text {
    font-size: 22rpx;
    color: #8E8E93;
  }
  
  .meta-sep {
    color: #333333;
  }
}

.session-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #2C2C2C;
  padding-top: 12rpx;
  
  text {
    font-size: 22rpx;
    color: #8E8E93;
  }
  
  .session-time {
    color: #C1F80A;
    font-weight: 600;
  }
}

.invite-actions {
  display: flex;
  gap: 20rpx;
  padding-top: 16rpx;
  border-top: 1px dashed #2C2C2C;

  .invite-btn {
    flex: 1;
    font-size: 24rpx;
    font-weight: 700;
    border-radius: 30rpx;
    padding: 14rpx 0;
    line-height: 1.2;
    border: none;

    &.accept {
      background-color: #C1F80A;
      color: #121212;
    }

    &.decline {
      background-color: #2C2C2C;
      color: #FF3B30;
    }
  }
}
</style>
