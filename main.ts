import { createApp } from 'vue';
import App from './src/App.vue'; // This will be the root layout containing <router-view>
import './src/style.css';
// 导入 dat.gui 的 CSS
import 'dat.gui/build/dat.gui.css';
import router from './src/routes'; // Import the router instance we created above

// Initialize window.VIEWER for compatibility with viewer.ts
if (typeof window !== 'undefined') {
	window.VIEWER = window.VIEWER || {};
}

// Check WebGL Support
function isWebGLAvailable() {
	try {
		const canvas = document.createElement('canvas');
		return !!(window.WebGLRenderingContext &&
			(canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
	} catch (e) {
		return false;
	}
}

if (!(window.File && window.FileReader && window.FileList && window.Blob)) {
	console.error('The File APIs are not fully supported in this browser.');
} else if (!isWebGLAvailable()) {
	console.error('WebGL is not supported in this browser.');
}

const app = createApp(App);

app.use(router);

app.mount('#app');