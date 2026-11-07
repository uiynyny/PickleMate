import { defineStore } from 'pinia';
import { apiRequest } from '../services/api';
import { realtimeBus } from '../services/socket';

export const useChatStore = defineStore('chat', {
  state: () => ({
    rooms: [] as any[],
    dms: [] as any[],
    activeMessages: [] as any[],
    activeTitle: '' as string,
  }),
  actions: {
    async fetchRooms() {
      const res = await apiRequest<any[]>({
        url: '/chat/rooms',
        method: 'GET',
      });
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        this.rooms = res.data;
      }
      return this.rooms;
    },

    async fetchDms() {
      const res = await apiRequest<any[]>({
        url: '/chat/dm',
        method: 'GET',
      });
      if (res.statusCode === 200 && Array.isArray(res.data)) {
        this.dms = res.data;
      }
      return this.dms;
    },

    async openCourtRoom(courtId: string) {
      const res = await apiRequest<any>({
        url: `/chat/rooms/court/${courtId}`,
        method: 'POST',
      });
      return res;
    },

    async openSessionRoom(sessionId: string) {
      const res = await apiRequest<any>({
        url: `/chat/rooms/session/${sessionId}`,
        method: 'POST',
      });
      return res;
    },

    async openDm(targetUserId: string) {
      const res = await apiRequest<any>({
        url: `/chat/dm/${targetUserId}`,
        method: 'POST',
      });
      return res;
    },

    async fetchRoomMessages(roomId: string) {
      const res = await apiRequest<{ room: any; messages: any[] }>({
        url: `/chat/rooms/${roomId}/messages?page=1&limit=50`,
        method: 'GET',
        auth: false,
      });
      if (res.statusCode === 200 && res.data) {
        this.activeMessages = res.data.messages || [];
        this.activeTitle = res.data.room?.name || '群聊';
      }
      return res;
    },

    async fetchDmMessages(dmId: string) {
      const res = await apiRequest<{ dm: any; messages: any[] }>({
        url: `/chat/dm/${dmId}/messages?page=1&limit=50`,
        method: 'GET',
      });
      if (res.statusCode === 200 && res.data) {
        this.activeMessages = res.data.messages || [];
        this.activeTitle = res.data.dm?.partner?.nickname
          ? `与 ${res.data.dm.partner.nickname} 的私信`
          : '私信会话';
      }
      return res;
    },

    async sendRoomMessage(
      roomId: string,
      payload: {
        content: string;
        type?: 'TEXT' | 'IMAGE' | 'POLL';
        parentId?: string;
        pollOptions?: string[];
      },
    ) {
      const res = await apiRequest<any>({
        url: `/chat/rooms/${roomId}/messages`,
        method: 'POST',
        data: payload,
      });
      if (res.statusCode === 201 && res.data) {
        this.activeMessages.push(res.data);
        realtimeBus.emit('chat:message', res.data);
      }
      return res;
    },

    async sendDmMessage(
      dmId: string,
      payload: {
        content: string;
        type?: 'TEXT' | 'IMAGE';
        parentId?: string;
      },
    ) {
      const res = await apiRequest<any>({
        url: `/chat/dm/${dmId}/messages`,
        method: 'POST',
        data: payload,
      });
      if (res.statusCode === 201 && res.data) {
        this.activeMessages.push(res.data);
        realtimeBus.emit('dm:message', res.data);
      }
      return res;
    },

    async votePoll(messageId: string, optionId: string) {
      const res = await apiRequest<any>({
        url: `/chat/messages/${messageId}/vote`,
        method: 'POST',
        data: { optionId },
      });
      if (res.statusCode === 201 && res.data) {
        const idx = this.activeMessages.findIndex((m) => m.id === messageId);
        if (idx !== -1) {
          this.activeMessages[idx] = {
            ...this.activeMessages[idx],
            ...res.data,
          };
        }
        realtimeBus.emit('chat:pollUpdated', res.data);
      }
      return res;
    },
  },
});
