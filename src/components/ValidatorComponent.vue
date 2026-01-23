<template>
  <div v-if="toggleVisible" class="report-toggle-wrap">
    <ValidatorToggle
      :issues="report?.issues"
      :report-error="reportError"
      @close="hideToggle"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import ValidatorToggle from './ValidatorToggle.vue';

const props = defineProps({
  validator: {
    type: Object,
    required: true,
  },
});

const toggleVisible = ref(false);
const report = ref(null);
const reportError = ref(null);

// 监听 validator 的变化
watch(
  () => props.validator,
  (newValidator) => {
    if (newValidator) {
      // 如果 validator 有 report，显示 toggle
      if (newValidator.report) {
        report.value = newValidator.report;
        reportError.value = null;
        toggleVisible.value = true;
      }
    }
  },
  { immediate: true, deep: true }
);

const hideToggle = () => {
  toggleVisible.value = false;
  if (props.validator) {
    props.validator.hideToggle();
  }
};

// 暴露方法供外部调用
defineExpose({
  showToggle: () => {
    toggleVisible.value = true;
  },
  hideToggle,
  setReport: (newReport) => {
    report.value = newReport;
    reportError.value = null;
    toggleVisible.value = true;
  },
  setReportError: (error) => {
    reportError.value = error;
    report.value = null;
    toggleVisible.value = true;
  },
});
</script>
