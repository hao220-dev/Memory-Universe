<template>
  <PhasePanel
    eyebrow="Message Moderation"
    phase="Phase 4"
    title="留言管理"
    description="留言星球的后台审核模块。后端留言实体与审核接口尚未实现，本页不会展示任何虚构的待审核数据。"
    :features="[
      '留言表结构、提交接口与审核状态机（待审 / 通过 / 驳回）',
      '后台分页列表，支持按状态、关键词与时间筛选',
      '一键通过、驳回、置顶与删除，操作写入审计时间',
      '前台留言星球只读取已通过审核的留言'
    ]"
  />
</template>

<script setup lang="ts">
import PhasePanel from '@/components/common/PhasePanel.vue'
</script>
