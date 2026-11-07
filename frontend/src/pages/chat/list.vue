<template>
  <view class="container">
    <view class="header">
      <view>
        <text class="title">实时消息</text>
        <text class="subtitle">球场群聊 · 约球房间 · 球友私信</text>
      </view>
    </view>

    <view class="tabs">
      <view
        class="tab-item"
        :class="{ active: activeTab === 'rooms' }"
        @tap="switchTab('rooms')"
      >
        群聊 ({{ chatStore.rooms.length }})
      </view>
      <view
        class="tab-item"
        :class="{ active: activeTab === 'dms' }"
        @tap="switchTab('dms')"
      >
        私信 ({{ chatStore.dms.length }})
      </view>
    </view>

    <view v-if="!userStore.isLoggedIn" class="empty-state">
      <text class="empty-icon">💬</text>
      <text class="empty-title">请先登录查看消息</text>
      <text class="empty-sub">登录后即可加入球场群聊、约球群聊或与球友私信</text>
      <button class="btn-primary" @tap="goToProfile">前往个人中心登录</button>
    </view>

    <scroll-view v-else scroll-y class="list-scroll">
      <template v-if="activeTab === 'rooms'">
        <view v-if="chatStore.rooms.length === 0" class="empty-state">
          <text class="empty-icon">🏟️</text>
          <text class="empty-title">暂未加入任何群聊</text>
          <text class="empty-sub">在球场详情页点击「球场群聊」或在球局详情页点击「球局群聊」即可进入</text>
        </view>

        <view
          v-for="room in chatStore.rooms"
          :key="room.id"
          class="conv-card"
          @tap="openRoom(room)"
        >
          <view class="conv-badge" :class="room.courtId ? 'court' : 'session'">
            {{ room.courtId ? '球场' : '球局' }}
          </view>
          <view class="conv-body">
            <view class="conv-top">
              <text class="conv-title">{{ room.name }}</text>
              <text class="conv-time">{{ formatTime(room.lastMessage?.createdAt || room.updatedAt) }}</text>
            </view>
            <text class="conv-preview">{{ formatPreview(room.lastMessage) }}</text>
          </view>
        </view>
      </template>

      <template v-if="activeTab === 'dms'">
        <view v-if="chatStore.dms.length === 0" class="empty-state">
          <text class="empty-icon">🤝</text>
          <text class="empty-title">暂无私信会话</text>
          <text class="empty-sub">在球局详情页点击球友旁的「私信」即可发起一对一交流</text>
        </view>

        <view
          v-for="dm in chatStore.dms"
          :key="dm.id"
          class="conv-card"
          @tap="openDm(dm)"
        >
          <image
            class="dm-avatar"
            :src="dm.partner?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + (dm.partner?.id || 'dm')"
          />
          <view class="conv-body">
            <view class="conv-top">
              <view class="partner-row">
                <text class="conv-title">{{ dm.partner?.nickname || '球友' }}</text>
                <text class="dupr-tag" v-if="dm.partner?.skillLevel">DUPR {{ Number(dm.partner.skillLevel).toFixed(1) }}</text>
              </view>
              <text class="conv-time">{{ formatTime(dm.lastMessage?.createdAt || dm.updatedAt) }}</text>
            </view>
            <text class="conv-preview">{{ formatPreview(dm.lastMessage) }}</text>
          </view>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { useChatStore } from '../../stores/chat';
import { useUserStore } from '../../stores/user';

const chatStore = useChatStore();
const userStore = useUserStore();
const activeTab = ref<'rooms' | 'dms'>('rooms');

const loadList = async () => {
  userStore.hydrate();
  if (!userStore.isLoggedIn) return;
  await Promise.all([chatStore.fetchRooms(), chatStore.fetchDms()]);
};

const switchTab = (tab: 'rooms' | 'dms') => {
  activeTab.value = tab;
  loadList();
};

const openRoom = (room: any) => {
  uni.navigateTo({
    url: `/pages/chat/room?roomId=${room.id}&title=${encodeURIComponent(room.name || '群聊')}`,
  });
};

const openDm = (dm: any) => {
  const title = dm.partner?.nickname ? `与 ${dm.partner.nickname} 的私信` : '私信';
  uni.navigateTo({
    url: `/pages/chat/room?dmId=${dm.id}&title=${encodeURIComponent(title)}`,
  });
};

const goToProfile = () => {
  uni.switchTab({ url: '/pages/profile/profile' });
};

const formatPreview = (msg: any) => {
  if (!msg) return '暂无消息，点击开始交流';
  const nickname = msg.user?.nickname || msg.sender?.nickname;
  const senderPrefix = nickname ? `${nickname}: ` : '';
  if (msg.type === 'POLL') return `${senderPrefix}[投票] ${msg.content}`;
  if (msg.type === 'IMAGE') return `${senderPrefix}[图片]`;
  return `${senderPrefix}${msg.content}`;
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  const date = new Date(iso);
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

onShow(() => {
  loadList();
});
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background-color: #121212;
  color: #ffffff;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 50rpx 36rpx 24rpx;
  background: #1a1a1a;
  .title {
    font-size: 44rpx;
    font-weight: 800;
    display: block;
    margin-bottom: 6rpx;
  }
  .subtitle {
    font-size: 24rpx;
    color: #888;
  }
}

.tabs {
  display: flex;
  padding: 20rpx 36rpx;
  gap: 20rpx;
  background: #1a1a1a;
  border-bottom: 2rpx solid #2a2a2a;
  .tab-item {
    padding: 14rpx 32rpx;
    border-radius: 36rpx;
    font-size: 26rpx;
    color: #999;
    background: #252525;
    &.active {
      background: #c1f80a;
      color: #121212;
      font-weight: bold;
    }
  }
}

.list-scroll {
  flex: 1;
  padding: 24rpx 32rpx;
}

.conv-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  background: #1e1e1e;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
  border: 2rpx solid #2c2c2c;
}

.conv-badge {
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 800;
  flex-shrink: 0;
  &.court {
    background: rgba(193, 248, 10, 0.16);
    color: #c1f80a;
    border: 2rpx solid rgba(193, 248, 10, 0.4);
  }
  &.session {
    background: rgba(56, 189, 248, 0.16);
    color: #38bdf8;
    border: 2rpx solid rgba(56, 189, 248, 0.4);
  }
}

.dm-avatar {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  background: #333;
  flex-shrink: 0;
}

.conv-body {
  flex: 1;
  min-width: 0;
  .conv-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10rpx;
  }
  .partner-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
  }
  .conv-title {
    font-size: 30rpx;
    font-weight: bold;
    color: #fff;
  }
  .dupr-tag {
    font-size: 20rpx;
    background: #2b2b2b;
    color: #c1f80a;
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
  }
  .conv-time {
    font-size: 22rpx;
    color: #666;
  }
  .conv-preview {
    font-size: 26rpx;
    color: #999;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.empty-state {
  padding: 120rpx 48rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  .empty-icon {
    font-size: 72rpx;
    margin-bottom: 20rpx;
  }
  .empty-title {
    font-size: 32rpx;
    font-weight: bold;
    margin-bottom: 12rpx;
  }
  .empty-sub {
    font-size: 24rpx;
    color: #888;
    margin-bottom: 36rpx;
    line-height: 1.5;
  }
  .btn-primary {
    background: #c1f80a;
    color: #121212;
    font-weight: bold;
    font-size: 28rpx;
    padding: 16rpx 48rpx;
    border-radius: 40rpx;
  }
}
</style>
