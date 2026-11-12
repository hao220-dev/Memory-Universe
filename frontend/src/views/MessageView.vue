<template>
  <section class="subpage">
    <div class="mu-container">
      <PhasePanel
        eyebrow="Message Planet"
        phase="Phase 4"
        title="留言星球"
        description="把那些在毕业典礼上没说完的话，发射到同一片星域。留言会经过馆长审核后公开，避免星海被噪声淹没。"
        :features="[
          '访客填写昵称、留言内容与星球坐标，提交到后端待审核队列',
          '馆长在后台逐条审核、置顶或删除，只有通过审核的留言才会公开',
          '留言以漂浮信号卡的形式呈现在 3D 星域中，支持按时间与热度浏览',
          '移动端提供紧凑列表视图，保证触屏也能顺畅阅读与留言'
        ]"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import PhasePanel from '@/components/common/PhasePanel.vue'
</script>
