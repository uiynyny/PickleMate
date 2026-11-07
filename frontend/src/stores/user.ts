import { defineStore } from 'pinia';
import { apiRequest } from '../services/api';

export interface UserStats {
  checkInsCount: number;
  favoriteCourtsCount: number;
  hostedSessionsCount: number;
  joinedSessionsCount: number;
}

export interface UserEntity {
  id: string;
  nickname: string;
  avatarUrl: string;
  skillLevel: number | null;
  bio: string | null;
  phone: string | null;
  email: string | null;
  isVerified: boolean;
  isActive?: boolean;
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '' as string,
    refreshToken: '' as string,
    user: null as UserEntity | null,
    stats: {
      checkInsCount: 0,
      favoriteCourtsCount: 0,
      hostedSessionsCount: 0,
      joinedSessionsCount: 0,
    } as UserStats,
  }),
  getters: {
    isLoggedIn: (state) => Boolean(state.token && state.user),
    isActiveUser: (state) => Boolean(state.user?.phone || state.user?.isActive),
  },
  actions: {
    hydrate() {
      const token = uni.getStorageSync('token') || '';
      const refreshToken = uni.getStorageSync('refreshToken') || '';
      const userStr = uni.getStorageSync('user');
      this.token = token;
      this.refreshToken = refreshToken;
      if (userStr) {
        try {
          this.user = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;
        } catch {
          this.user = null;
        }
      }
    },

    hydrateFromStorage() {
      this.hydrate();
    },

    persistSession(accessToken: string, refreshToken: string, user: any) {
      this.token = accessToken;
      this.refreshToken = refreshToken || '';
      this.user = {
        id: user.id,
        nickname: user.nickname || '球友',
        avatarUrl: user.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback',
        skillLevel: user.skillLevel ?? 3.5,
        bio: user.bio ?? null,
        phone: user.phone ?? null,
        email: user.email ?? null,
        isVerified: Boolean(user.isVerified),
        isActive: Boolean(user.phone),
      };
      uni.setStorageSync('token', accessToken);
      if (refreshToken) {
        uni.setStorageSync('refreshToken', refreshToken);
      }
      uni.setStorageSync('user', JSON.stringify(this.user));
    },

    async requestOtp(phone: string) {
      return apiRequest<{ message: string; code: string }>({
        url: '/auth/otp/request',
        method: 'POST',
        data: { phone },
        auth: false,
      });
    },

    async verifyOtp(phone: string, code: string) {
      const res = await apiRequest<{ accessToken: string; refreshToken: string; user: any }>({
        url: '/auth/otp/verify',
        method: 'POST',
        data: { phone, code },
        auth: false,
      });
      if (res.statusCode === 201 && res.data?.accessToken) {
        this.persistSession(res.data.accessToken, res.data.refreshToken, res.data.user);
      }
      return res;
    },

    async appleQuickLogin(appleUserId?: string, nickname?: string) {
      const id = appleUserId || `apple_${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await apiRequest<{ accessToken: string; refreshToken: string; user: any }>({
        url: '/auth/apple/login',
        method: 'POST',
        data: { appleUserId: id, nickname },
        auth: false,
      });
      if (res.statusCode === 201 && res.data?.accessToken) {
        this.persistSession(res.data.accessToken, res.data.refreshToken, res.data.user);
      }
      return res;
    },

    async linkPhone(phone: string, code: string) {
      const res = await apiRequest<{ accessToken: string; refreshToken: string; user: any }>({
        url: '/auth/phone/link',
        method: 'POST',
        data: { phone, code },
      });
      if (res.statusCode === 201 && res.data?.accessToken) {
        this.persistSession(res.data.accessToken, res.data.refreshToken, res.data.user);
      }
      return res;
    },

    async fetchProfile() {
      this.hydrate();
      if (!this.token) return null;
      const res = await apiRequest<any>({
        url: '/users/profile',
        method: 'GET',
      });
      if (res.statusCode === 200 && res.data) {
        const p = res.data;
        this.user = {
          id: p.id,
          nickname: p.nickname || '球友',
          avatarUrl: p.avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=fallback',
          skillLevel: p.skillLevel ?? 3.5,
          bio: p.bio ?? null,
          phone: p.phone ?? null,
          email: p.email ?? null,
          isVerified: Boolean(p.isVerified),
          isActive: Boolean(p.isActive ?? p.phone),
        };
        if (p.stats) {
          this.stats = {
            checkInsCount: p.stats.checkInsCount ?? 0,
            favoriteCourtsCount: p.stats.favoriteCourtsCount ?? 0,
            hostedSessionsCount: p.stats.hostedSessionsCount ?? 0,
            joinedSessionsCount: p.stats.joinedSessionsCount ?? 0,
          };
        }
        uni.setStorageSync('user', JSON.stringify(this.user));
      }
      return this.user;
    },

    async updateProfile(payload: {
      nickname?: string;
      bio?: string;
      skillLevel?: number;
      avatarUrl?: string;
    }) {
      const res = await apiRequest<any>({
        url: '/users/profile',
        method: 'PATCH',
        data: payload,
      });
      if (res.statusCode === 200 && res.data) {
        await this.fetchProfile();
      }
      return res;
    },

    async logout() {
      try {
        if (this.token) {
          await apiRequest({ url: '/auth/logout', method: 'POST' });
        }
      } catch {
        // Ignore network errors during logout
      }
      this.token = '';
      this.refreshToken = '';
      this.user = null;
      this.stats = {
        checkInsCount: 0,
        favoriteCourtsCount: 0,
        hostedSessionsCount: 0,
        joinedSessionsCount: 0,
      };
      uni.removeStorageSync('token');
      uni.removeStorageSync('refreshToken');
      uni.removeStorageSync('user');
    },
  },
});
