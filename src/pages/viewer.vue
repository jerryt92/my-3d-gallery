<template>
	<div class="app gallery-viewport">
		<header v-if="!options.kiosk" class="app-header glass-panel">
			<div class="app-header-inner">
				<h1 class="app-title">{{ title }}</h1>
			</div>
		</header>
		<main class="wrap">
			<div v-if="!viewerEl" class="dropzone" ref="dropzoneEl">
				<div class="placeholder glass-panel">
					<p class="placeholder-title">3D Gallery</p>
					<p class="placeholder-desc">Drag glTF 2.0 file or folder here</p>
				</div>
				<div class="upload-btn">
					<input
						type="file"
						name="file-input[]"
						id="file-input"
						ref="inputEl"
						multiple
						@change="handleFileInput"
					/>
					<label for="file-input" class="upload-button">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="17"
							viewBox="0 0 20 17"
						>
							<path
								d="M10 0l-5.2 4.9h3.3v5.1h3.8v-5.1h3.3l-5.2-4.9zm9.3 11.5l-3.2-2.1h-2l3.4 2.6h-3.5c-.1 0-.2.1-.2.1l-.8 2.3h-6l-.8-2.2c-.1-.1-.1-.2-.2-.2h-3.6l3.4-2.6h-2l-3.2 2.1c-.4.3-.7 1-.6 1.5l.6 3.1c.1.5.7.9 1.2.9h16.3c.6 0 1.1-.4 1.3-.9l.6-3.1c.1-.5-.2-1.2-.7-1.5z"
							></path>
						</svg>
						<span>Choose file</span>
					</label>
				</div>
			</div>
			<div v-if="viewerEl" ref="viewerContainer" class="viewer-wrapper"></div>
			<div v-if="showSpinner" class="spinner-overlay">
				<div class="spinner-modern"></div>
				<p class="spinner-text">
					Loading model...
					<span v-if="loadProgress !== null"> {{ Math.floor(loadProgress) }}%</span>
				</p>
			</div>
			<ValidatorComponent v-if="validator" :validator="validator" />
		</main>
	</div>
</template>

<script setup>
import { onMounted, onUnmounted, ref, computed, watch, nextTick, inject } from 'vue';
import { useRoute } from 'vue-router';
import { useViewer } from '@/composables/useViewer';
import { useValidator } from '@/composables/useValidator';
import ValidatorComponent from '@/components/ValidatorComponent.vue';
import { SimpleDropzone } from 'simple-dropzone';

const route = useRoute();
const baseTitle = inject('webBaseTitle', '3D Gallery');
const title = ref(baseTitle);
const dropzoneEl = ref(null);
const inputEl = ref(null);
const viewerContainer = ref(null);
const viewerEl = ref(null);
const showSpinner = ref(false);
const loadProgress = ref(null);
const validator = ref(null);

const params = computed(() => route.query);

const modelParam = computed(() => {
	const param = params.value.model ? String(params.value.model) : '';
	return param;
});

const options = computed(() => ({
	kiosk: Boolean(params.value.kiosk),
	model: modelParam.value,
	preset: String(params.value.preset || ''),
	cameraPosition: params.value.cameraPosition
		? String(params.value.cameraPosition).split(',').map(Number)
		: null,
}));

const { viewer, createViewer } = useViewer(options.value);
const { createValidator } = useValidator();

watch(() => modelParam.value, (newModel, oldModel) => {
	if (newModel && newModel !== oldModel) {
		showSpinner.value = true;
		loadProgress.value = 0;
		view(newModel, '', new Map());
	}
}, { immediate: false });

onMounted(() => {
	// dat.gui 的容器是 fixed/top:0；viewer 有顶部标题栏时需要整体下移，避免遮挡标题
	const updateBodyClass = () => {
		if (options.value.kiosk) document.body.classList.remove('viewer-has-header');
		else document.body.classList.add('viewer-has-header');
	};
	updateBodyClass();

	if (dropzoneEl.value && inputEl.value) {
		const dropCtrl = new SimpleDropzone(dropzoneEl.value, inputEl.value);
		dropCtrl.on('drop', ({ files }) => load(files));
		dropCtrl.on('dropstart', () => {
			showSpinner.value = true;
			loadProgress.value = 0;
		});
		dropCtrl.on('droperror', () => {
			showSpinner.value = false;
			loadProgress.value = null;
		});
	}

	validator.value = createValidator();

	if (modelParam.value) {
		showSpinner.value = true;
		loadProgress.value = 0;
		view(modelParam.value, '', new Map());
	}
});

watch(
	() => options.value.kiosk,
	() => {
		if (options.value.kiosk) document.body.classList.remove('viewer-has-header');
		else document.body.classList.add('viewer-has-header');
	},
	{ immediate: false },
);

onUnmounted(() => {
	document.body.classList.remove('viewer-has-header');
});

const handleFileInput = (event) => {
	const files = event.target.files;
	if (files && files.length > 0) {
		const fileMap = new Map();
		Array.from(files).forEach((file) => {
			fileMap.set(file.name, file);
		});
		load(fileMap);
	}
};

const load = (fileMap) => {
	let rootFile;
	let rootPath;
	Array.from(fileMap).forEach(([path, file]) => {
		if (file.name.match(/\.(gltf|glb)$/)) {
			rootFile = file;
			rootPath = path.replace(file.name, '');
		}
	});

	if (!rootFile) {
		onError('No .gltf or .glb asset found.');
		return;
	}

	view(rootFile, rootPath, fileMap);
};

const view = async (rootFile, rootPath, fileMap) => {
	if (!viewer.value) {
		viewerEl.value = document.createElement('div');
		viewerEl.value.classList.add('viewer');

		await nextTick();

		if (viewerContainer.value) {
			viewerContainer.value.innerHTML = '';
			viewerContainer.value.appendChild(viewerEl.value);
		} else {
			const container = document.querySelector('.wrap');
			if (container) {
				const tempContainer = document.createElement('div');
				tempContainer.className = 'viewer-wrapper';
				tempContainer.appendChild(viewerEl.value);
				container.appendChild(tempContainer);
			}
		}

		viewer.value = createViewer(viewerEl.value);
	} else {
		viewer.value.clear();
	}

	const fileURL = typeof rootFile === 'string' ? rootFile : URL.createObjectURL(rootFile);

	const cleanup = () => {
		showSpinner.value = false;
		loadProgress.value = null;
		if (typeof rootFile === 'object') URL.revokeObjectURL(fileURL);
	};

	showSpinner.value = true;
	loadProgress.value = 0;

	try {
		console.log('Loading model:', fileURL);
		const gltf = await viewer.value.load(fileURL, rootPath, fileMap, (percent) => {
			loadProgress.value = percent;
		});
		console.log('Model loaded successfully:', gltf);
		cleanup();
	} catch (e) {
		console.error('Error loading model:', e);
		onError(e);
		cleanup();
	}
};

const onError = (error) => {
	let message = (error || {}).message || error.toString();
	if (message.match(/ProgressEvent/)) {
		message = 'Unable to retrieve this file. Check JS console and browser network tab.';
	} else if (message.match(/Unexpected token/)) {
		message = `Unable to parse file content. Verify that this file is valid. Error: "${message}"`;
	} else if (error && error.target && error.target instanceof Image) {
		message = 'Missing texture: ' + error.target.src.split('/').pop();
	}
	window.alert(message);
	console.error(error);
	showSpinner.value = false;
	loadProgress.value = null;
};
</script>

<style scoped>
/* 容器布局 */
.app {
	position: relative;
	width: 100%;
	height: 100vh;
	overflow: hidden;
	background-color: #1e1e1e;
	color: #eee;
}

/* -----------------------
   美化后的 Header 样式
------------------------ */
.app-header {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 50px; /* 紧凑高度 */
	z-index: 100; /* 确保在 Canvas 之上 */
	display: flex;
	align-items: center;
	padding: 0 20px;
	box-sizing: border-box;

	/* 毛玻璃效果 + 渐变黑底 */
	background: rgba(20, 20, 20, 0.75);
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);

	/* 底部微弱分割线 */
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.app-header-inner {
	display: flex;
	align-items: center;
	width: 100%;
}

.app-title {
	margin: 0;
	/* 缩小字体 */
	font-size: 15px;
	font-weight: 500;
	/* 增加字间距，显得更精致 */
	letter-spacing: 0.5px;
	color: #f0f0f0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* -----------------------
   主体内容
------------------------ */
.wrap {
	width: 100%;
	height: 100%;
	position: relative;
}

.viewer-wrapper {
	width: 100%;
	height: 100%;
	overflow: hidden;
}

/* 拖拽区域 */
.dropzone {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	background: radial-gradient(circle at center, #2a2a2a 0%, #111 100%);
}

.placeholder {
	text-align: center;
	padding: 40px;
	border-radius: 16px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px dashed rgba(255, 255, 255, 0.2);
	margin-bottom: 20px;
}

.placeholder-title {
	font-size: 24px;
	margin-bottom: 10px;
	font-weight: bold;
}

.placeholder-desc {
	font-size: 14px;
	color: #aaa;
}

/* 上传按钮样式 */
.upload-btn {
	position: relative;
	overflow: hidden;
}

#file-input {
	display: none;
}

.upload-button {
	display: inline-flex;
	align-items: center;
	gap: 8px;
	padding: 10px 24px;
	background: #3b82f6;
	color: white;
	border-radius: 8px;
	cursor: pointer;
	font-size: 14px;
	font-weight: 500;
	transition: background 0.2s;
}

.upload-button:hover {
	background: #2563eb;
}

.upload-button svg {
	fill: currentColor;
}

/* 加载 Spinner 样式 */
.spinner-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.6);
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	z-index: 200;
	backdrop-filter: blur(4px);
}

.spinner-modern {
	width: 40px;
	height: 40px;
	border: 3px solid rgba(255, 255, 255, 0.3);
	border-radius: 50%;
	border-top-color: #fff;
	animation: spin 1s ease-in-out infinite;
	margin-bottom: 16px;
}

.spinner-text {
	font-size: 14px;
	color: #fff;
	font-weight: 500;
}

@keyframes spin {
	to { transform: rotate(360deg); }
}
</style>