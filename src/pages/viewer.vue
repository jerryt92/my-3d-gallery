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
import { onMounted, ref, computed, watch, nextTick, inject } from 'vue';
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
// number | null：null 表示未加载/不显示进度
const loadProgress = ref(null);
const validator = ref(null);

// 解析 URL 参数 - 在 Web History 模式下，route.query 包含查询参数
// URL 格式: /?model=xxx&kiosk=true
// route.query 会包含 { model: 'xxx', kiosk: 'true' }
const params = computed(() => route.query);

// 获取原始 model 参数（不拼接路径，因为 loadModelInfo 会处理）
const modelParam = computed(() => {
	const param = params.value.model ? String(params.value.model) : '';
	return param;
});

// 响应式的 options
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

// 监听 model 参数变化，重新加载模型
watch(() => modelParam.value, (newModel, oldModel) => {
	if (newModel && newModel !== oldModel) {
		// 显示加载状态
		showSpinner.value = true;
		loadProgress.value = 0;
		// 加载模型 - 传入原始参数，loadModelInfo 会处理路径
		view(newModel, '', new Map());
	}
}, { immediate: false });

onMounted(() => {
	// 初始化拖拽区域
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

	// 初始化验证器
	validator.value = createValidator();

	// 如果有预设模型，加载它
	if (modelParam.value) {
		showSpinner.value = true;
		loadProgress.value = 0;
		view(modelParam.value, '', new Map());
	}
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
	// 确保 viewer 已创建
	if (!viewer.value) {
		// 创建 viewer 容器元素（这会触发 Vue 的响应式更新，显示 viewerContainer）
		viewerEl.value = document.createElement('div');
		viewerEl.value.classList.add('viewer');
		
		// 等待 Vue 更新 DOM（viewerContainer 现在应该已经渲染）
		await nextTick();
		
		// 将 viewer 添加到 viewerContainer
		if (viewerContainer.value) {
			viewerContainer.value.innerHTML = '';
			viewerContainer.value.appendChild(viewerEl.value);
		} else {
			// 如果 viewerContainer 不存在，创建一个临时容器
			const container = document.querySelector('.wrap');
			if (container) {
				const tempContainer = document.createElement('div');
				tempContainer.className = 'viewer-wrapper';
				tempContainer.appendChild(viewerEl.value);
				container.appendChild(tempContainer);
			}
		}
		
		// 使用最新的 options 创建 viewer
		viewer.value = createViewer(viewerEl.value);
	} else {
		// 如果 viewer 已存在，清除之前的内容
		viewer.value.clear();
	}

	// 如果是字符串路径，直接传递给 load 方法（loadModelInfo 会处理）
	// 如果是 File 对象，创建 blob URL
	const fileURL = typeof rootFile === 'string' ? rootFile : URL.createObjectURL(rootFile);

	const cleanup = () => {
		showSpinner.value = false;
		loadProgress.value = null;
		if (typeof rootFile === 'object') URL.revokeObjectURL(fileURL);
	};

	// 显示加载状态
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
