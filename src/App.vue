<template>
	<router-view />
</template>

<script setup lang="ts">
import { onMounted, provide, watch } from 'vue';
import { useRoute } from 'vue-router';
import { webBaseTitle } from '@/oem';

// Provide base title for any page/component to consume (avoid scattered imports).
provide('webBaseTitle', webBaseTitle);

const route = useRoute();

const syncDocumentTitle = () => {
	// Keep tab title consistent across route navigations.
	document.title = webBaseTitle;
};

onMounted(syncDocumentTitle);
watch(() => route.fullPath, syncDocumentTitle);
</script>
