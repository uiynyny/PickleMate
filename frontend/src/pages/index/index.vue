<template>
  <view class="container">
    <!-- Header Section -->
    <view class="header">
      <text class="title">PickleMate</text>
      <text class="subtitle">Find & Register Pickleball Courts</text>
    </view>

    <!-- Search and Filter Bar -->
    <view class="search-section">
      <view class="search-bar">
        <icon type="search" size="16" color="#8E8E93" class="search-icon" />
        <input 
          class="search-input" 
          type="text" 
          placeholder="Search courts near you..." 
          placeholder-style="color: #666666"
          v-model="searchQuery"
          @confirm="onSearch"
        />
      </view>
      <view class="register-btn-wrap" @tap="handleRegisterTap">
        <text class="register-btn-text">＋ Register</text>
      </view>
    </view>

    <!-- Filter Chips -->
    <scroll-view class="filter-scroll" scroll-x="true" show-scrollbar="false">
      <view class="filter-chips">
        <view 
          v-for="filter in filters" 
          :key="filter.id"
          :class="['filter-chip', activeFilters.includes(filter.id) ? 'active' : '']"
          @tap="toggleFilter(filter.id)"
        >
          <text class="filter-chip-text">{{ filter.label }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- Map Area -->
    <view class="map-container">
      <map 
        id="court-map"
        class="court-map" 
        :latitude="mapLat" 
        :longitude="mapLng" 
        :markers="mapMarkers"
        show-location
        @markertap="onMarkerTap"
        @regionchange="onRegionChange"
      >
        <cover-view class="map-overlay">
          <cover-view class="map-badge">
            <cover-view class="badge-dot"></cover-view>
            <cover-view class="badge-text">Showing {{ filteredCourts.length }} Courts Nearby</cover-view>
          </cover-view>
        </cover-view>
      </map>
    </view>

    <!-- Court List Section -->
    <view class="list-section">
      <view class="list-header">
        <text class="list-title">Nearby Courts</text>
        <text class="list-action" @tap="useCurrentLocation">Recenter Map</text>
      </view>

      <view class="court-list">
        <view v-if="filteredCourts.length === 0" class="empty-state">
          <text class="empty-text">No courts found matching filters.</text>
        </view>
        <view 
          v-for="court in filteredCourts" 
          :key="court.id" 
          class="court-card"
          @tap="navigateToDetail(court)"
        >
          <image class="court-image" src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=300&q=80" mode="aspectFill" />
          <view class="court-details">
            <view class="court-header-row">
              <text class="court-name">{{ court.name }}</text>
              <view class="rating-badge">
                <text class="rating-star">★</text>
                <text class="rating-text">{{ court.rating }}</text>
              </view>
            </view>
            <text class="court-address">{{ court.address }}</text>
            
            <!-- Features and distance tags -->
            <view class="court-tags">
              <text class="tag distance-tag">{{ court.distance }}</text>
              <text v-if="court.isIndoor" class="tag indoor-tag">Indoor</text>
              <text v-else class="tag outdoor-tag">Outdoor</text>
              <text v-if="court.hasLights" class="tag lights-tag">💡 Lights</text>
              <text class="tag net-tag">{{ court.netType }}</text>
            </view>

            <!-- Social Activity Badge -->
            <view class="activity-bar">
              <view class="activity-users">
                <view class="mini-avatar green-dot"></view>
                <text class="activity-text">{{ court.activePlayers }} players checked in today</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- Auth / OTP Modal -->
    <view v-if="showAuthModal" class="modal-backdrop">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">手机验证快捷登录</text>
          <text class="modal-close" @tap="showAuthModal = false">✕</text>
        </view>
        <view class="modal-body">
          <text class="modal-desc">注册或创建球场前，请先绑定您的手机号</text>
          
          <view class="input-group">
            <input 
              class="modal-input" 
              type="number" 
              maxlength="11"
              placeholder="请输入手机号" 
              placeholder-style="color: #666666"
              v-model="authPhone"
            />
          </view>

          <view class="input-group row">
            <input 
              class="modal-input code-input" 
              type="number" 
              maxlength="4"
              placeholder="验证码" 
              placeholder-style="color: #666666"
              v-model="authCode"
            />
            <button class="send-code-btn" :disabled="countdown > 0" @tap="sendOtp">
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </button>
          </view>
          <text v-if="otpToast" class="otp-hint">开发模式验证码: {{ otpToast }}</text>
          
          <button class="submit-btn" @tap="submitAuth">确认登录</button>
        </view>
      </view>
    </view>

    <!-- Court Registration Modal (UGC) -->
    <view v-if="showRegisterModal" class="modal-backdrop">
      <view class="modal-content">
        <view class="modal-header">
          <text class="modal-title">＋ 注册新球场</text>
          <text class="modal-close" @tap="showRegisterModal = false">✕</text>
        </view>
        <view class="modal-body scrollable">
          <text class="modal-desc">坐标将自动锁定在您当前的地图中心：</text>
          <text class="coord-desc">经度: {{ regLng.toFixed(5) }} | 纬度: {{ regLat.toFixed(5) }}</text>
          
          <view class="input-group-label">球场名称</view>
          <view class="input-group">
            <input 
              class="modal-input" 
              type="text" 
              placeholder="例如：朝阳公园匹克球馆" 
              placeholder-style="color: #666666"
              v-model="regName"
            />
          </view>

          <view class="input-group-label">详细地址</view>
          <view class="input-group">
            <input 
              class="modal-input" 
              type="text" 
              placeholder="例如：朝阳区朝阳公园南路1号" 
              placeholder-style="color: #666666"
              v-model="regAddress"
            />
          </view>

          <view class="input-group-label">场地数量</view>
          <view class="input-group">
            <input 
              class="modal-input" 
              type="number" 
              placeholder="共有多少片球场" 
              placeholder-style="color: #666666"
              v-model="regNumCourts"
            />
          </view>

          <!-- Select Toggles -->
          <view class="toggle-row">
            <view class="toggle-item">
              <text class="toggle-label">室内球场</text>
              <switch :checked="regIsIndoor" color="#C1F80A" @change="regIsIndoor = $event.detail.value" />
            </view>
            <view class="toggle-item">
              <text class="toggle-label">有照明灯</text>
              <switch :checked="regHasLights" color="#C1F80A" @change="regHasLights = $event.detail.value" />
            </view>
          </view>

          <view class="input-group-label">球网类型</view>
          <radio-group class="radio-row" @change="regNetType = $event.detail.value">
            <label class="radio-label">
              <radio value="permanent" checked color="#C1F80A" /> 固定网
            </label>
            <label class="radio-label">
              <radio value="portable" color="#C1F80A" /> 便携网
            </label>
          </radio-group>

          <view class="input-group-label">地面类型</view>
          <radio-group class="radio-row" @change="regSurfaceType = $event.detail.value">
            <label class="radio-label">
              <radio value="acrylic" checked color="#C1F80A" /> 丙烯酸
            </label>
            <label class="radio-label">
              <radio value="asphalt" color="#C1F80A" /> 沥青
            </label>
            <label class="radio-label">
              <radio value="concrete" color="#C1F80A" /> 水泥
            </label>
            <label class="radio-label">
              <radio value="wood" color="#C1F80A" /> 木地板
            </label>
          </radio-group>

          <button class="submit-btn" @tap="submitRegister">提交球场</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { apiRequest } from '../../services/api';

interface Court {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  isIndoor: boolean;
  hasLights: boolean;
  netType: string;
  distance: string;
  rating: number;
  activePlayers: number;
}

// Map coordinate refs
const userLat = ref(39.9042);
const userLng = ref(116.4074);
const mapLat = ref(39.9042);
const mapLng = ref(116.4074);

const searchQuery = ref('');
const courts = ref<Court[]>([]);
const mapContext = ref<any>(null);

// Modals toggles
const showAuthModal = ref(false);
const showRegisterModal = ref(false);

// Auth inputs
const authPhone = ref('');
const authCode = ref('');
const countdown = ref(0);
const otpToast = ref('');
let timer: any = null;

// Register inputs (UGC)
const regLng = ref(0);
const regLat = ref(0);
const regName = ref('');
const regAddress = ref('');
const regIsIndoor = ref(false);
const regHasLights = ref(false);
const regNumCourts = ref('4');
const regNetType = ref('permanent');
const regSurfaceType = ref('acrylic');

const filters = [
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'lights', label: 'With Lights' },
  { id: 'permanent', label: 'Permanent Nets' }
];

const activeFilters = ref<string[]>([]);

// String Hashing helper to convert UUID string to integer safely for Map markers
const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    const character = value.charCodeAt(i);
    hash = ((hash << 5) - hash) + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

// Convert courts to Map Markers
const mapMarkers = computed(() => {
  return courts.value.map(court => ({
    id: hashString(court.id), // Map custom string ID to integer markers ID
    latitude: court.latitude,
    longitude: court.longitude,
    title: court.name,
    iconPath: '/static/tabbar/home-active.png',
    width: 28,
    height: 28,
    callout: {
      content: `${court.name}\n★ ${court.rating} | ${court.distance}`,
      color: '#FFFFFF',
      fontSize: 11,
      borderRadius: 6,
      bgColor: '#1E1E1E',
      padding: 6,
      display: 'ALWAYS'
    }
  }));
});

// Toggle search filters
const toggleFilter = (id: string) => {
  const index = activeFilters.value.indexOf(id);
  if (index > -1) {
    activeFilters.value.splice(index, 1);
  } else {
    activeFilters.value.push(id);
  }
};

// Filtered courts computation
const filteredCourts = computed(() => {
  return courts.value.filter(court => {
    // Search filter
    if (searchQuery.value && !court.name.toLowerCase().includes(searchQuery.value.toLowerCase())) {
      return false;
    }
    // Filter chips
    if (activeFilters.value.includes('indoor') && !court.isIndoor) return false;
    if (activeFilters.value.includes('outdoor') && court.isIndoor) return false;
    if (activeFilters.value.includes('lights') && !court.hasLights) return false;
    if (activeFilters.value.includes('permanent') && court.netType !== 'Permanent') return false;
    
    return true;
  });
});

const onSearch = () => {
  console.log('Searching for:', searchQuery.value);
};

// Fetch nearby courts (circular radius)
const fetchNearbyCourts = async (lng: number, lat: number) => {
  try {
    const res = await apiRequest<any[]>({
      url: `/courts/nearby?lng=${encodeURIComponent(lng.toString())}&lat=${encodeURIComponent(lat.toString())}&radius=10000`,
      method: 'GET',
      auth: false,
    });
    if (res.statusCode === 200 && Array.isArray(res.data)) {
      courts.value = res.data.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        latitude: c.lat,
        longitude: c.lng,
        isIndoor: c.isIndoor,
        hasLights: c.hasLights,
        netType: c.netType === 'permanent' ? 'Permanent' : 'Portable',
        distance: c.distance ? `${(c.distance / 1000).toFixed(1)} km` : '0.1 km',
        rating: c.isVerified ? 4.9 : 4.5,
        activePlayers: Math.floor(Math.random() * 12) + 3
      }));
    }
  } catch (err) {
    console.error('Failed to fetch nearby courts:', err);
  }
};

// Fetch courts inside map viewport bounding box
const fetchViewportCourts = async (minLng: number, minLat: number, maxLng: number, maxLat: number) => {
  try {
    const res = await apiRequest<any[]>({
      url: `/courts/viewport?minLng=${minLng}&minLat=${minLat}&maxLng=${maxLng}&maxLat=${maxLat}`,
      method: 'GET',
      auth: false,
    });
    if (res.statusCode === 200 && Array.isArray(res.data)) {
      courts.value = res.data.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        latitude: c.lat,
        longitude: c.lng,
        isIndoor: c.isIndoor,
        hasLights: c.hasLights,
        netType: c.netType === 'permanent' ? 'Permanent' : 'Portable',
        distance: calculateDistance(userLng.value, userLat.value, c.lng, c.lat),
        rating: c.isVerified ? 4.9 : 4.5,
        activePlayers: Math.floor(Math.random() * 12) + 3
      }));
    }
  } catch (err) {
    console.error('Failed to fetch viewport courts:', err);
  }
};

// Precise client-side Haversine distance calculation
const calculateDistance = (lng1: number, lat1: number, lng2: number, lat2: number): string => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c;
  return `${(d / 1000).toFixed(1)} km`;
};

// Handle region change on map (User dragging/panning map)
const onRegionChange = (e: any) => {
  if (e.type === 'end' || e.causedBy === 'drag' || e.causedBy === 'scale') {
    if (mapContext.value) {
      mapContext.value.getRegion({
        success: (res: any) => {
          const { southwest, northeast } = res;
          fetchViewportCourts(southwest.longitude, southwest.latitude, northeast.longitude, northeast.latitude);
        }
      });
      mapContext.value.getCenterLocation({
        success: (res: any) => {
          // Keep current map center position updated for UGC registration mapping
          mapLng.value = res.longitude;
          mapLat.value = res.latitude;
        }
      });
    }
  }
};

const handleRegisterTap = () => {
  const token = uni.getStorageSync('token');
  if (!token) {
    showAuthModal.value = true;
  } else {
    // Center of registration points is exactly current map center
    regLng.value = mapLng.value;
    regLat.value = mapLat.value;
    showRegisterModal.value = true;
  }
};

const sendOtp = async () => {
  if (!authPhone.value || authPhone.value.length < 8) {
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' });
    return;
  }
  const res = await apiRequest<any>({
    url: '/auth/otp/request',
    method: 'POST',
    data: { phone: authPhone.value },
    auth: false,
  });
  if (res.statusCode === 201 && res.data) {
    uni.showToast({ title: '验证码已发送', icon: 'success' });
    otpToast.value = res.data.code; // Display directly in dev mode
    countdown.value = 60;
    timer = setInterval(() => {
      countdown.value--;
      if (countdown.value <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  }
};

const submitAuth = async () => {
  if (!authPhone.value || !authCode.value) {
    uni.showToast({ title: '手机号和验证码不能为空', icon: 'none' });
    return;
  }
  const res = await apiRequest<any>({
    url: '/auth/otp/verify',
    method: 'POST',
    data: { phone: authPhone.value, code: authCode.value },
    auth: false,
  });
  if (res.statusCode === 201 && res.data) {
    uni.setStorageSync('token', res.data.accessToken);
    if (res.data.refreshToken) {
      uni.setStorageSync('refreshToken', res.data.refreshToken);
    }
    uni.setStorageSync('user', JSON.stringify(res.data.user));
    uni.showToast({ title: '绑定验证成功', icon: 'success' });
    showAuthModal.value = false;

    // Open registration form immediately now that user is verified
    setTimeout(() => {
      handleRegisterTap();
    }, 800);
  } else {
    uni.showToast({ title: '验证码错误', icon: 'none' });
  }
};

const submitRegister = async () => {
  if (!regName.value || !regAddress.value) {
    uni.showToast({ title: '球场名称和地址不能为空', icon: 'none' });
    return;
  }
  const res = await apiRequest<any>({
    url: '/courts',
    method: 'POST',
    data: {
      name: regName.value,
      address: regAddress.value,
      lng: regLng.value,
      lat: regLat.value,
      isIndoor: regIsIndoor.value,
      hasLights: regHasLights.value,
      numCourts: parseInt(regNumCourts.value) || 4,
      netType: regNetType.value,
      surfaceType: regSurfaceType.value,
    },
  });
  if (res.statusCode === 201) {
    uni.showToast({ title: '球场注册成功！', icon: 'success' });
    showRegisterModal.value = false;

    // Reset fields
    regName.value = '';
    regAddress.value = '';

    // Refresh local nearby courts
    fetchNearbyCourts(mapLng.value, mapLat.value);
  } else if (res.statusCode === 409) {
    // High fidelity duplicate alert!
    uni.showModal({
      title: '球场重复警示',
      content: res.data?.message || '您附近 50 米内已存在该球场，请确认是否重复创建。',
      showCancel: false,
      confirmText: '我知道了',
    });
  } else {
    uni.showToast({ title: res.data?.message || '创建失败', icon: 'none' });
  }
};

const navigateToDetail = (court: Court) => {
  uni.navigateTo({
    url: `/pages/court/detail?id=${court.id}`
  });
};

const onMarkerTap = (e: any) => {
  // Matches hashcode of court ID
  const markerId = e.detail.markerId;
  const foundCourt = courts.value.find(c => hashString(c.id) === markerId);
  if (foundCourt) {
    uni.showToast({
      title: `${foundCourt.name} | ${foundCourt.distance}`,
      icon: 'none'
    });
  }
};

const useCurrentLocation = () => {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      userLat.value = res.latitude;
      userLng.value = res.longitude;
      mapLat.value = res.latitude;
      mapLng.value = res.longitude;
      
      // Load courts near current GPS location
      fetchNearbyCourts(res.longitude, res.latitude);
    },
    fail: () => {
      uni.showToast({
        title: '无法获取定位权限，加载默认位置',
        icon: 'none'
      });
      // Fallback to load default area
      fetchNearbyCourts(mapLng.value, mapLat.value);
    }
  });
};

onMounted(() => {
  mapContext.value = uni.createMapContext('court-map');
  useCurrentLocation();
});
</script>

<style lang="scss" scoped>
.container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: #121212;
  color: #FFFFFF;
  padding: 30rpx;
}

.header {
  margin-bottom: 25rpx;
  
  .title {
    font-size: 48rpx;
    font-weight: 800;
    color: #C1F80A;
    letter-spacing: 1rpx;
  }
  
  .subtitle {
    font-size: 24rpx;
    color: #8E8E93;
    margin-top: 5rpx;
    display: block;
  }
}

.search-section {
  display: flex;
  align-items: center;
  gap: 15rpx;
  margin-bottom: 20rpx;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  background-color: #1E1E1E;
  border-radius: 40rpx;
  padding: 15rpx 25rpx;
  border: 1px solid #2C2C2C;
  
  .search-icon {
    margin-right: 15rpx;
  }
  
  .search-input {
    flex: 1;
    color: #FFFFFF;
    font-size: 28rpx;
  }
}

.register-btn-wrap {
  background-color: #C1F80A;
  border-radius: 40rpx;
  padding: 18rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .register-btn-text {
    color: #121212;
    font-weight: 700;
    font-size: 26rpx;
  }
}

.filter-scroll {
  width: 100%;
  margin-bottom: 30rpx;
}

.filter-chips {
  display: flex;
  gap: 15rpx;
  padding: 5rpx 0;
  white-space: nowrap;
}

.filter-chip {
  background-color: #1E1E1E;
  padding: 12rpx 28rpx;
  border-radius: 30rpx;
  border: 1px solid #2C2C2C;
  display: inline-block;
  
  .filter-chip-text {
    color: #8E8E93;
    font-size: 24rpx;
    font-weight: 500;
  }
  
  &.active {
    background-color: rgba(#C1F80A, 0.15);
    border-color: #C1F80A;
    
    .filter-chip-text {
      color: #C1F80A;
      font-weight: 700;
    }
  }
}

.map-container {
  width: 100%;
  height: 400rpx;
  border-radius: 20rpx;
  overflow: hidden;
  margin-bottom: 40rpx;
  border: 1px solid #2C2C2C;
  position: relative;
}

.court-map {
  width: 100%;
  height: 100%;
}

.map-overlay {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
}

.map-badge {
  background-color: rgba(30, 30, 30, 0.85);
  border-radius: 30rpx;
  padding: 10rpx 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
  backdrop-filter: blur(5px);
  border: 1px solid #333333;
}

.badge-dot {
  width: 12rpx;
  height: 12rpx;
  background-color: #C1F80A;
  border-radius: 50%;
}

.badge-text {
  color: #FFFFFF;
  font-size: 22rpx;
  font-weight: 600;
}

.list-section {
  display: flex;
  flex-direction: column;
  gap: 25rpx;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .list-title {
    font-size: 36rpx;
    font-weight: 700;
    letter-spacing: 0.5rpx;
  }
  
  .list-action {
    color: #C1F80A;
    font-size: 24rpx;
    font-weight: 600;
  }
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60rpx 0;
  
  .empty-text {
    color: #666666;
    font-size: 26rpx;
  }
}

.court-list {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.court-card {
  background-color: #1E1E1E;
  border-radius: 20rpx;
  overflow: hidden;
  border: 1px solid #2C2C2C;
  display: flex;
  flex-direction: column;
}

.court-image {
  width: 100%;
  height: 220rpx;
}

.court-details {
  padding: 25rpx;
  display: flex;
  flex-direction: column;
}

.court-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10rpx;
  
  .court-name {
    font-size: 32rpx;
    font-weight: 700;
    color: #FFFFFF;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 15rpx;
  }
}

.rating-badge {
  display: flex;
  align-items: center;
  gap: 6rpx;
  background-color: rgba(255, 193, 7, 0.1);
  padding: 6rpx 14rpx;
  border-radius: 12rpx;
  
  .rating-star {
    color: #FFC107;
    font-size: 24rpx;
    line-height: 1;
  }
  
  .rating-text {
    color: #FFC107;
    font-size: 22rpx;
    font-weight: 700;
  }
}

.court-address {
  font-size: 24rpx;
  color: #8E8E93;
  line-height: 1.4;
  margin-bottom: 20rpx;
}

.court-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.tag {
  font-size: 20rpx;
  font-weight: 600;
  padding: 6rpx 16rpx;
  border-radius: 8rpx;
  
  &.distance-tag {
    background-color: #2C2C2C;
    color: #FFFFFF;
  }
  
  &.indoor-tag {
    background-color: rgba(0, 122, 255, 0.1);
    color: #007AFF;
  }
  
  &.outdoor-tag {
    background-color: rgba(255, 149, 0, 0.1);
    color: #FF9500;
  }
  
  &.lights-tag {
    background-color: rgba(193, 248, 10, 0.1);
    color: #C1F80A;
  }
  
  &.net-tag {
    background-color: #2C2C2C;
    color: #8E8E93;
  }
}

.activity-bar {
  border-top: 1px solid #2C2C2C;
  padding-top: 15rpx;
  display: flex;
  align-items: center;
}

.activity-users {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.mini-avatar {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  
  &.green-dot {
    background-color: #C1F80A;
    box-shadow: 0 0 10rpx #C1F80A;
  }
}

.activity-text {
  font-size: 22rpx;
  color: #8E8E93;
  font-weight: 500;
}

/* Modals Backdrop */
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
  overflow: hidden;
  max-height: 90vh;
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
  
  &.scrollable {
    overflow-y: auto;
  }
}

.modal-desc {
  font-size: 26rpx;
  color: #8E8E93;
  line-height: 1.5;
}

.coord-desc {
  font-size: 24rpx;
  color: #C1F80A;
  font-weight: 600;
  background-color: rgba(193, 248, 10, 0.05);
  padding: 10rpx;
  border-radius: 8rpx;
  text-align: center;
  margin-bottom: 10rpx;
}

.input-group-label {
  font-size: 24rpx;
  font-weight: 600;
  color: #FFFFFF;
  margin-top: 10rpx;
}

.input-group {
  background-color: #121212;
  border: 1px solid #2C2C2C;
  border-radius: 12rpx;
  padding: 20rpx 25rpx;
  display: flex;
  align-items: center;
  
  &.row {
    flex-direction: row;
    padding: 10rpx 15rpx 10rpx 25rpx;
    gap: 15rpx;
  }
  
  .modal-input {
    flex: 1;
    color: #FFFFFF;
    font-size: 28rpx;
    
    &.code-input {
      max-width: 250rpx;
    }
  }
}

.send-code-btn {
  background-color: #C1F80A;
  color: #121212;
  font-size: 24rpx;
  font-weight: 700;
  border-radius: 8rpx;
  padding: 15rpx 25rpx;
  line-height: 1.2;
  
  &[disabled] {
    background-color: #2C2C2C;
    color: #666666;
  }
}

.otp-hint {
  font-size: 22rpx;
  color: #C1F80A;
  font-weight: 600;
  text-align: center;
}

.toggle-row {
  display: flex;
  gap: 30rpx;
  margin-top: 10rpx;
}

.toggle-item {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #121212;
  border: 1px solid #2C2C2C;
  border-radius: 12rpx;
  padding: 15rpx 20rpx;
  
  .toggle-label {
    font-size: 26rpx;
    color: #8E8E93;
    font-weight: 500;
  }
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
