import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
	{
		path: '/',
		name: 'preview',
		component: () => import('@/pages/previewGallery.vue'),
		// Back-compat: older links used `/?model=...` (viewer) or `/?models=...`.
		// If the home page has model params, redirect to `/viewer` instead.
		beforeEnter: (to) => {
			const q: Record<string, any> = { ...(to.query as any) };
			const models = q.models;
			const model = q.model ?? (typeof models === 'string' ? models : undefined);
			if (model) {
				q.model = model;
				delete q.models;
				return { path: '/viewer', query: q, replace: true };
			}
			return true;
		},
	},
	{
		path: '/viewer',
		name: 'viewer',
		component: () => import('@/pages/viewer.vue'),
	},
	{
		// Back-compat for the previous gallery route.
		path: '/preview',
		redirect: '/',
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