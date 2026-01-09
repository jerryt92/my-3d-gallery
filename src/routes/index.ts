import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		name: 'viewer',
		component: () => import('@/pages/viewer.vue'),
	},
	{
		path: '/preview',
		name: 'preview',
		component: () => import('@/pages/previewGallery.vue'),
	},
];

// Create the router instance with Web History (no hash)
const router = createRouter({
	// IMPORTANT: pass Vite base so the app works when deployed under a sub-path
	history: createWebHistory(import.meta.env.BASE_URL),
	routes,
});

// Helper function to switch routes programmatically
export const goTo = (path: string) => {
	router.push(path);
};

export default router;