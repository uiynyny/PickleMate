<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";

onLaunch(() => {
  console.log("App Launch");
});

onShow(() => {
  console.log("App Show");
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style lang="scss">
/* Global styles */
@import "./uni.scss";

body {
  margin: 0;
  padding: 0;
  background-color: $bg-color-main;
}

page {
  background-color: $bg-color-main;
  color: $text-color-main;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  min-height: 100vh;
}
</style>
