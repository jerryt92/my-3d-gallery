<template>
  <div :class="['report-toggle', levelClassName]">
    <div class="report-toggle-text">{{ message }}</div>
    <div class="report-toggle-close" aria-label="Hide" @click="$emit('close')">
      &times;
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  issues: {
    type: Object,
    default: null,
  },
  reportError: {
    type: [String, Error],
    default: null,
  },
});

defineEmits(['close']);

const levelClassName = computed(() => {
  if (props.issues) {
    return `level-${props.issues.maxSeverity}`;
  }
  return '';
});

const message = computed(() => {
  if (props.issues) {
    if (props.issues.numErrors) {
      return `${props.issues.numErrors} errors.`;
    } else if (props.issues.numWarnings) {
      return `${props.issues.numWarnings} warnings.`;
    } else if (props.issues.numHints) {
      return `${props.issues.numHints} hints.`;
    } else if (props.issues.numInfos) {
      return `${props.issues.numInfos} notes.`;
    } else {
      return 'Model details';
    }
  } else if (props.reportError) {
    return `Validation could not run: ${props.reportError}.`;
  } else {
    return 'Validation could not run.';
  }
});
</script>
