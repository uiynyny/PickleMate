<template>
  <view class="room-container">
    <view class="room-header">
      <text class="room-title">{{ pageTitle || chatStore.activeTitle || '实时交流' }}</text>
      <text class="room-mode">{{ roomId ? '群聊房间' : '私信会话' }}</text>
    </view>

    <scroll-view scroll-y class="messages-scroll">
      <view v-if="chatStore.activeMessages.length === 0" class="empty-chat">
        <text>暂无消息，发条消息破冰吧！</text>
      </view>

      <view
        v-for="msg in chatStore.activeMessages"
        :key="msg.id"
        class="msg-row"
        :class="{ mine: (msg.userId || msg.senderId) === currentUserId }"
      >
        <image
          class="msg-avatar"
          :src="(msg.user || msg.sender)?.avatarUrl || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + (msg.userId || msg.senderId || 'user')"
        />
        <view class="msg-bubble-wrap">
          <view class="msg-meta">
            <text class="sender-name">{{ (msg.user || msg.sender)?.nickname || '球友' }}</text>
            <text class="sender-dupr" v-if="(msg.user || msg.sender)?.skillLevel">DUPR {{ Number((msg.user || msg.sender).skillLevel).toFixed(1) }}</text>
            <text class="msg-time">{{ formatTime(msg.createdAt) }}</text>
            <text class="reply-btn" @tap="setReply(msg)">回复</text>
          </view>

          <view class="msg-bubble">
            <!-- Quoted parent message -->
            <view v-if="msg.parent" class="quoted-parent">
              <text class="quoted-author">@{{ (msg.parent.user || msg.parent.sender)?.nickname || '球友' }}：</text>
              <text class="quoted-text">{{ msg.parent.content }}</text>
            </view>

            <!-- IMAGE message -->
            <view v-if="msg.type === 'IMAGE'" class="image-msg">
              <image class="chat-image" :src="msg.content" mode="widthFix" />
            </view>

            <!-- POLL message -->
            <view v-else-if="msg.type === 'POLL'" class="poll-card">
              <view class="poll-header">
                <text class="poll-tag">📊 群投票</text>
                <text class="poll-question">{{ msg.content }}</text>
              </view>
              <view class="poll-options">
                <view
                  v-for="opt in getPollOptions(msg)"
                  :key="opt.id"
                  class="poll-opt"
                  :class="{ voted: hasVotedOption(opt) }"
                  @tap="handleVote(msg.id, opt.id)"
                >
                  <view class="poll-opt-top">
                    <text class="opt-text">{{ opt.text }}</text>
                    <text class="opt-count">{{ (opt.voterIds || []).length }} 票 ({{ getOptionPercent(msg, opt) }}%)</text>
                  </view>
                  <view class="poll-bar-bg">
                    <view class="poll-bar-fill" :style="{ width: getOptionPercent(msg, opt) + '%' }"></view>
                  </view>
                </view>
              </view>
            </view>

            <!-- TEXT / SYSTEM message -->
            <text v-else class="msg-text">{{ msg.content }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- Reply Banner -->
    <view v-if="replyingTo" class="reply-banner">
      <text class="reply-info">回复 @{{ (replyingTo.user || replyingTo.sender)?.nickname || '球友' }}: {{ replyingTo.content }}</text>
      <text class="reply-cancel" @tap="replyingTo = null">✕</text>
    </view>

    <!-- Action & Input Bar -->
    <view class="composer">
      <view class="composer-tools">
        <button v-if="roomId" class="tool-btn" @tap="showPollModal = true">+ 投票</button>
        <button class="tool-btn" @tap="showImageModal = true">+ 图片</button>
      </view>
      <view class="composer-row">
        <input
          class="msg-input"
          v-model="draftText"
          placeholder="输入消息..."
          confirm-type="send"
          @confirm="handleSendText"
        />
        <button class="send-btn" @tap="handleSendText">发送</button>
      </view>
    </view>

    <!-- Poll Creation Modal -->
    <view v-if="showPollModal" class="modal-mask" @tap="showPollModal = false">
      <view class="modal-card" @tap.stop>
        <text class="modal-title">发起群投票</text>
        <input class="modal-input" v-model="pollQuestion" placeholder="投票主题 (如：周六下午3点谁来？)" />
        <view v-for="(opt, idx) in pollOptions" :key="idx" class="opt-input-row">
          <input class="modal-input" v-model="pollOptions[idx]" :placeholder="'选项 ' + (idx + 1)" />
        </view>
        <view class="modal-actions">
          <button v-if="pollOptions.length < 4" class="btn-outline" @tap="pollOptions.push('')">+ 添加选项</button>
          <button class="btn-primary" @tap="handleCreatePoll">发布投票</button>
        </view>
      </view>
    </view>

    <!-- Image URL Modal -->
    <view v-if="showImageModal" class="modal-mask" @tap="showImageModal = false">
      <view class="modal-card" @tap.stop>
        <text class="modal-title">发送球场/装备图片</text>
        <input class="modal-input" v-model="imageUrl" placeholder="输入图片链接 (https://...)" />
        <view class="modal-actions">
          <button class="btn-outline" @tap="showImageModal = false">取消</button>
          <button class="btn-primary" @tap="handleSendImage">发送图片</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue';
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { useChatStore } from '../../stores/chat';
import { useUserStore } from '../../stores/user';

const chatStore = useChatStore();
const userStore = useUserStore();

const roomId = ref('');
const dmId = ref('');
const pageTitle = ref('');
const draftText = ref('');
const replyingTo = ref<any | null>(null);

const showPollModal = ref(false);
const pollQuestion = ref('');
const pollOptions = ref<string[]>(['参加', '待定']);

const showImageModal = ref(false);
const imageUrl = ref('');

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const currentUserId = computed(() => userStore.user?.id || '');

const loadMessages = async () => {
  if (roomId.value) {
    await chatStore.fetchRoomMessages(roomId.value);
  } else if (dmId.value) {
    await chatStore.fetchDmMessages(dmId.value);
  }
};

const setReply = (msg: any) => {
  replyingTo.value = msg;
};

const getPollOptions = (msg: any) => {
  if (Array.isArray(msg?.parsedPollOptions)) {
    return msg.parsedPollOptions;
  }
  if (Array.isArray(msg?.metadata?.options)) {
    return msg.metadata.options;
  }
  return [];
};

const handleSendText = async () => {
  const content = draftText.value.trim();
  if (!content) return;

  const parentId = replyingTo.value?.id;
  let res;
  if (roomId.value) {
    res = await chatStore.sendRoomMessage(roomId.value, {
      content,
      type: 'TEXT',
      parentId,
    });
  } else if (dmId.value) {
    res = await chatStore.sendDmMessage(dmId.value, {
      content,
      type: 'TEXT',
      parentId,
    });
  }

  if (res && res.statusCode === 201) {
    draftText.value = '';
    replyingTo.value = null;
  } else {
    uni.showToast({
      title: (res?.data as any)?.message || '请先激活手机号后发送消息',
      icon: 'none',
    });
  }
};

const handleCreatePoll = async () => {
  const cleanOpts = pollOptions.value.map((o) => o.trim()).filter(Boolean);
  if (!pollQuestion.value.trim() || cleanOpts.length < 2) {
    uni.showToast({ title: '请填写问题及至少2个选项', icon: 'none' });
    return;
  }
  const res = await chatStore.sendRoomMessage(roomId.value, {
    content: pollQuestion.value.trim(),
    type: 'POLL',
    pollOptions: cleanOpts,
  });
  if (res.statusCode === 201) {
    showPollModal.value = false;
    pollQuestion.value = '';
    pollOptions.value = ['参加', '待定'];
  } else {
    uni.showToast({ title: (res.data as any)?.message || '发起投票失败', icon: 'none' });
  }
};

const handleSendImage = async () => {
  if (!imageUrl.value.trim()) return;
  const payload = {
    content: imageUrl.value.trim(),
    type: 'IMAGE' as const,
    parentId: replyingTo.value?.id,
  };
  const res = roomId.value
    ? await chatStore.sendRoomMessage(roomId.value, payload)
    : await chatStore.sendDmMessage(dmId.value, payload);

  if (res.statusCode === 201) {
    showImageModal.value = false;
    imageUrl.value = '';
    replyingTo.value = null;
  } else {
    uni.showToast({ title: (res.data as any)?.message || '发送失败', icon: 'none' });
  }
};

const handleVote = async (messageId: string, optionId: string) => {
  const res = await chatStore.votePoll(messageId, optionId);
  if (res.statusCode !== 201) {
    uni.showToast({ title: (res.data as any)?.message || '投票需要登录并激活账号', icon: 'none' });
  }
};

const hasVotedOption = (opt: any) => {
  return Array.isArray(opt?.voterIds) && opt.voterIds.includes(currentUserId.value);
};

const getOptionPercent = (msg: any, opt: any) => {
  const options = getPollOptions(msg);
  const total = options.reduce((sum: number, item: any) => sum + ((item.voterIds || []).length), 0);
  if (total === 0) return 0;
  return Math.round(((opt.voterIds || []).length / total) * 100);
};

const formatTime = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
};

const stopTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};

onLoad((options) => {
  userStore.hydrate();
  if (options?.roomId) roomId.value = options.roomId;
  if (options?.dmId) dmId.value = options.dmId;
  if (options?.title) pageTitle.value = decodeURIComponent(options.title);
  loadMessages();
  refreshTimer = setInterval(loadMessages, 4000);
});

onUnload(() => {
  stopTimer();
});

onUnmounted(() => {
  stopTimer();
});
</script>

<style lang="scss" scoped>
.room-container {
  min-height: 100vh;
  background: #121212;
  color: #ffffff;
  display: flex;
  flex-direction: column;
}

.room-header {
  padding: 28rpx 32rpx;
  background: #1a1a1a;
  border-bottom: 2rpx solid #2a2a2a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  .room-title {
    font-size: 32rpx;
    font-weight: bold;
  }
  .room-mode {
    font-size: 22rpx;
    color: #c1f80a;
    background: rgba(193, 248, 10, 0.14);
    padding: 6rpx 16rpx;
    border-radius: 20rpx;
  }
}

.messages-scroll {
  flex: 1;
  padding: 24rpx;
  padding-bottom: 220rpx;
}

.empty-chat {
  text-align: center;
  padding: 100rpx 20rpx;
  color: #777;
  font-size: 26rpx;
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
  margin-bottom: 28rpx;
  &.mine {
    flex-direction: row-reverse;
    .msg-meta {
      flex-direction: row-reverse;
    }
    .msg-bubble {
      background: #253309;
      border-color: rgba(193, 248, 10, 0.45);
    }
  }
}

.msg-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #2c2c2c;
  flex-shrink: 0;
}

.msg-bubble-wrap {
  max-width: 76%;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
  .sender-name {
    font-size: 22rpx;
    color: #aaa;
    font-weight: bold;
  }
  .sender-dupr {
    font-size: 18rpx;
    color: #c1f80a;
    background: #222;
    padding: 2rpx 10rpx;
    border-radius: 6rpx;
  }
  .msg-time {
    font-size: 20rpx;
    color: #666;
  }
  .reply-btn {
    font-size: 20rpx;
    color: #38bdf8;
  }
}

.msg-bubble {
  background: #1e1e1e;
  border: 2rpx solid #2e2e2e;
  border-radius: 20rpx;
  padding: 20rpx 24rpx;
}

.quoted-parent {
  background: rgba(255, 255, 255, 0.06);
  border-left: 6rpx solid #c1f80a;
  padding: 10rpx 16rpx;
  border-radius: 8rpx;
  margin-bottom: 14rpx;
  font-size: 22rpx;
  color: #bbb;
}

.msg-text {
  font-size: 28rpx;
  line-height: 1.45;
  color: #f5f5f5;
}

.chat-image {
  max-width: 420rpx;
  border-radius: 14rpx;
}

.poll-card {
  min-width: 440rpx;
  .poll-header {
    margin-bottom: 16rpx;
    .poll-tag {
      font-size: 20rpx;
      color: #c1f80a;
      display: block;
      margin-bottom: 6rpx;
    }
    .poll-question {
      font-size: 28rpx;
      font-weight: bold;
    }
  }
  .poll-opt {
    background: #151515;
    border: 2rpx solid #333;
    border-radius: 14rpx;
    padding: 14rpx 18rpx;
    margin-bottom: 12rpx;
    &.voted {
      border-color: #c1f80a;
    }
    .poll-opt-top {
      display: flex;
      justify-content: space-between;
      font-size: 24rpx;
      margin-bottom: 8rpx;
    }
    .poll-bar-bg {
      height: 10rpx;
      background: #2a2a2a;
      border-radius: 6rpx;
      overflow: hidden;
      .poll-bar-fill {
        height: 100%;
        background: #c1f80a;
      }
    }
  }
}

.reply-banner {
  position: fixed;
  bottom: 164rpx;
  left: 0;
  right: 0;
  background: #242424;
  padding: 12rpx 32rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 24rpx;
  color: #c1f80a;
}

.composer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1a1a1a;
  border-top: 2rpx solid #2c2c2c;
  padding: 16rpx 24rpx 28rpx;
  .composer-tools {
    display: flex;
    gap: 16rpx;
    margin-bottom: 14rpx;
    .tool-btn {
      margin: 0;
      font-size: 22rpx;
      background: #282828;
      color: #ddd;
      border-radius: 24rpx;
      padding: 4rpx 22rpx;
      line-height: 1.8;
    }
  }
  .composer-row {
    display: flex;
    gap: 16rpx;
    align-items: center;
    .msg-input {
      flex: 1;
      background: #262626;
      border-radius: 36rpx;
      padding: 16rpx 28rpx;
      font-size: 28rpx;
      color: #fff;
    }
    .send-btn {
      margin: 0;
      background: #c1f80a;
      color: #121212;
      font-weight: bold;
      font-size: 26rpx;
      border-radius: 36rpx;
      padding: 0 34rpx;
      height: 72rpx;
      line-height: 72rpx;
    }
  }
}

.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-card {
  width: 84%;
  background: #1e1e1e;
  border-radius: 24rpx;
  padding: 36rpx;
  border: 2rpx solid #333;
  .modal-title {
    font-size: 32rpx;
    font-weight: bold;
    display: block;
    margin-bottom: 24rpx;
  }
  .modal-input {
    background: #141414;
    border: 2rpx solid #333;
    border-radius: 14rpx;
    padding: 18rpx 22rpx;
    color: #fff;
    font-size: 26rpx;
    margin-bottom: 16rpx;
  }
  .modal-actions {
    display: flex;
    gap: 20rpx;
    margin-top: 20rpx;
    button {
      flex: 1;
      font-size: 26rpx;
      border-radius: 14rpx;
    }
    .btn-outline {
      background: #2b2b2b;
      color: #fff;
    }
    .btn-primary {
      background: #c1f80a;
      color: #121212;
      font-weight: bold;
    }
  }
}
</style>
