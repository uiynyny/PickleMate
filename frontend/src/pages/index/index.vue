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
      <view class="register-btn-wrap" @tap="navigateToRegister">
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

    <!-- Map Area Mockup / Native Map -->
    <view class="map-container">
      <!-- In production, we use a real <map> component. For rich styling we add an overlay. -->
      <map 
        class="court-map" 
        :latitude="userLat" 
        :longitude="userLng" 
        :markers="mapMarkers"
        show-location
        @markertap="onMarkerTap"
      >
        <cover-view class="map-overlay">
          <cover-view class="map-badge">
            <cover-view class="badge-dot"></cover-view>
            <cover-view class="badge-text">Showing 3 Courts Nearby</cover-view>
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
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

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

// User current coordinates (defaults to Beijing as dummy center, can update dynamically)
const userLat = ref(39.9042);
const userLng = ref(116.4074);
const searchQuery = ref('');

const filters = [
  { id: 'indoor', label: 'Indoor' },
  { id: 'outdoor', label: 'Outdoor' },
  { id: 'lights', label: 'With Lights' },
  { id: 'permanent', label: 'Permanent Nets' }
];

const activeFilters = ref<string[]>([]);

const courts = ref<Court[]>([
  {
    id: '1',
    name: 'Olympic Park Pickleball Club',
    address: 'East Gate of Olympic Forest Park, Chaoyang District',
    latitude: 39.9050,
    longitude: 116.4080,
    isIndoor: false,
    hasLights: true,
    netType: 'Permanent',
    distance: '1.2 km',
    rating: 4.8,
    activePlayers: 18
  },
  {
    id: '2',
    name: 'Indoor Paddle Court Center',
    address: 'No. 88 Workers Stadium Road, Chaoyang District',
    latitude: 39.9020,
    longitude: 116.4040,
    isIndoor: true,
    hasLights: true,
    netType: 'Permanent',
    distance: '2.5 km',
    rating: 4.9,
    activePlayers: 24
  },
  {
    id: '3',
    name: 'Community Sports Park Court',
    address: 'Beiyuan Road Yard No. 5, Chaoyang District',
    latitude: 39.9090,
    longitude: 116.4120,
    isIndoor: false,
    hasLights: false,
    netType: 'Portable',
    distance: '3.8 km',
    rating: 4.2,
    activePlayers: 5
  }
]);

// Convert courts to Map Markers
const mapMarkers = computed(() => {
  return courts.value.map(court => ({
    id: parseInt(court.id),
    latitude: court.latitude,
    longitude: court.longitude,
    title: court.name,
    iconPath: '/static/tabbar/home-active.png', // Fallback placeholder
    width: 32,
    height: 32,
    callout: {
      content: court.name + '\n★ ' + court.rating,
      color: '#FFFFFF',
      fontSize: 12,
      borderRadius: 6,
      bgColor: '#1E1E1E',
      padding: 8,
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

const navigateToRegister = () => {
  uni.showToast({
    title: 'Court Registry coming soon!',
    icon: 'none'
  });
};

const navigateToDetail = (court: Court) => {
  uni.showToast({
    title: `Selected ${court.name}`,
    icon: 'none'
  });
};

const onMarkerTap = (e: any) => {
  const markerId = e.detail.markerId.toString();
  const foundCourt = courts.value.find(c => c.id === markerId);
  if (foundCourt) {
    uni.showToast({
      title: `Map select: ${foundCourt.name}`,
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
      uni.showToast({
        title: 'Map centered to location',
        icon: 'none'
      });
    },
    fail: () => {
      uni.showToast({
        title: 'Location permission denied',
        icon: 'none'
      });
    }
  });
};

onMounted(() => {
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
</style>
