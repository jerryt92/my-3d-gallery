<template>
	<div class="preview-page">
		<div class="background-blur" :style="{ backgroundImage: `url(${activeBg})` }"></div>

		<header class="gallery-header">
			<h1>{{ webBaseTitle }}</h1>
			<p>Select a model to view in 3D</p>
		</header>

		<div class="swiper-container">
			<Swiper
				:modules="modules"
				:effect="'coverflow'"
				:grabCursor="true"
				:centeredSlides="true"
				:slidesPerView="'auto'"
				:mousewheel="{
					// Allow vertical mousewheel (deltaY) to control horizontal swiper.
					forceToAxis: false,
					sensitivity: 1.2,
					thresholdDelta: 10,
					releaseOnEdges: true,
				}"
				:coverflowEffect="{
					rotate: 50,
					stretch: 0,
					depth: 100,
					modifier: 1,
					slideShadows: true,
				}"
				:keyboard="{ enabled: true }"
				@slideChange="onSlideChange"
				class="mySwiper"
			>
				<SwiperSlide v-for="entry in displayModels" :key="entry.id">
					<div class="model-card" @click="goToViewer(entry.id)">
						<div class="card-image">
							<img
								v-if="thumbs[entry.modelUrl]"
								:src="thumbs[entry.modelUrl] as string"
								:alt="entry.name"
								class="model-thumb"
								loading="lazy"
							/>
							<div v-else class="placeholder-icon">📦</div>
						</div>
						<div class="card-info">
							<h3>{{ entry.name }}</h3>
							<button class="view-btn">View Model</button>
						</div>
					</div>
				</SwiperSlide>
			</Swiper>
			<div v-if="!isLoading && displayModels.length === 0" class="empty-state">
				No models found. Check `public/info.json`.
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Swiper as SwiperVue, SwiperSlide as SwiperSlideVue } from 'swiper/vue';
import { EffectCoverflow, Keyboard, Mousewheel } from 'swiper/modules';
// 导入 Swiper 样式
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import { useModelThumbnails } from '@/composables/useModelThumbnails';
import { webBaseTitle } from '@/oem.ts';

// `swiper/vue` 的 TS 定义在模板类型检查里不完整（部分 props 会被推断为不存在）。
// 这里做一次显式 cast，避免 mousewheel/keyboard 等配置在模板里报错。
const Swiper = SwiperVue as any;
const SwiperSlide = SwiperSlideVue as any;

const router = useRouter();
const isLoading = ref(false);
const modelsData = ref<Record<string, any>>({});
const activeIndex = ref(0);
const thumbs = ref<Record<string, string | null>>({});

const { ensure: ensureThumb } = useModelThumbnails({
	width: 512,
	height: 512,
	background: null,
	// 缩略图生成会解析 glb/贴图，放到 idle 阶段 + 单通道队列，尽量不影响 Swiper 交互
	schedule: 'idle',
	maxConcurrent: 1,
});

const PREFETCH_RADIUS = 2;
const PREFETCH_FIRST_N = 7;
let prefetchRestTimer: number | null = null;

function prefetchThumb(url: string) {
	// 已有缩略图则跳过
	if (thumbs.value[url]) return;
	ensureThumb(url).then((dataUrl) => {
		if (dataUrl) thumbs.value[url] = dataUrl;
	});
}

function prefetchPriority() {
	const models = displayModels.value;
	if (!models.length) return;

	const urls = new Set<string>();

	// 首屏前 N 个
	for (let i = 0; i < Math.min(PREFETCH_FIRST_N, models.length); i++) {
		urls.add(models[i].modelUrl);
	}

	// 当前激活附近
	for (let i = activeIndex.value - PREFETCH_RADIUS; i <= activeIndex.value + PREFETCH_RADIUS; i++) {
		const m = models[i];
		if (m) urls.add(m.modelUrl);
	}

	urls.forEach((u) => prefetchThumb(u));
}

function schedulePrefetchRest() {
	if (prefetchRestTimer) window.clearTimeout(prefetchRestTimer);
	// 给用户一点时间先滚动/切换，后台再补齐全部缩略图
	prefetchRestTimer = window.setTimeout(() => {
		displayModels.value.forEach((m) => prefetchThumb(m.modelUrl));
	}, 900);
}

// 获取并过滤数据
onMounted(async () => {
	try {
		isLoading.value = true;
		const res = await fetch(
			`${import.meta.env.BASE_URL === '/' ? '.' : import.meta.env.BASE_URL}/info.json`,
		);
		const data = await res.json();
		modelsData.value = data;
	} catch (e) {
		console.error('Failed to load models info', e);
	} finally {
		isLoading.value = false;
	}
});

type DisplayModel = { id: string; name: string; modelUrl: string };

const displayModels = computed<DisplayModel[]>(() => {
	// 仅展示 `public/info.json` 中明确标记 `show: true` 的条目。
	// 这样可以在 info.json 里保留一些“仅用于映射/别名”的记录（例如仅有 name 的 *.glb 键），但不在 preview 里展示。
	const byUrl = new Map<string, DisplayModel>();

	for (const [key, raw] of Object.entries(modelsData.value || {})) {
		if (!raw || raw.show !== true) continue;

		const modelUrl = String((raw && raw.url) || key);
		const looksLikeModel =
			modelUrl.startsWith('http') || modelUrl.endsWith('.glb') || modelUrl.endsWith('.gltf');
		if (!looksLikeModel) continue;

		const name = String((raw && raw.name) || key);
		if (!byUrl.has(modelUrl)) {
			byUrl.set(modelUrl, { id: key, name, modelUrl });
		}
	}

	return Array.from(byUrl.values());
});

const activeBg = computed(() => {
	// Optional: if your info.json ever adds `cover`/`bg`, use it here.
	// For now keep it blank so the blur layer doesn't break layout.
	return '';
});

watch(
	() => displayModels.value,
	(models) => {
		// 先初始化占位；不要一次性触发所有缩略图生成（会卡住主线程，影响 Swiper 交互）
		models.forEach((m) => {
			if (thumbs.value[m.modelUrl] === undefined) thumbs.value[m.modelUrl] = null;
		});

		// 优先生成首屏 + 当前附近几张，其余后台慢慢补齐
		prefetchPriority();
		schedulePrefetchRest();
	},
	{ immediate: true },
);

const onSlideChange = (swiper) => {
	activeIndex.value = swiper.activeIndex;
	prefetchPriority();
};

const goToViewer = (modelUrl: string) => {
	// Web History 模式下，使用 query 参数传递模型路径
	// URL 格式: /viewer?model=xxx
	router.push({
		path: '/viewer',
		query: { model: modelUrl },
	});
};

const modules = [EffectCoverflow, Keyboard, Mousewheel];
</script>

<style scoped>
.preview-page {
	position: relative;
	width: 100vw;
	height: 100vh;
	background: #000;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	color: white;
}

.background-blur {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-size: cover;
	background-position: center;
	filter: blur(50px) brightness(0.4);
	transition: background-image 0.5s ease;
	z-index: 0;
}

.gallery-header {
	position: relative;
	z-index: 1;
	text-align: center;
	padding: 40px 20px;
}

.swiper-container {
	flex: 1;
	display: flex;
	align-items: center;
	z-index: 1;
	padding-bottom: 50px;
	position: relative;
}

.mySwiper {
	width: 100%;
	padding-top: 50px;
	padding-bottom: 50px;
}

.swiper-slide {
	background-position: center;
	background-size: cover;
	width: 300px;
	height: 400px;
}

.model-card {
	background: rgba(255, 255, 255, 0.1);
	backdrop-filter: blur(10px);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 20px;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	cursor: pointer;
	transition: transform 0.3s;
}

.card-image {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
	background: linear-gradient(45deg, #1a1a1a, #333);
	position: relative;
	overflow: hidden;
}

.placeholder-icon {
	font-size: 80px;
}

.model-thumb {
	width: 100%;
	height: 100%;
	display: block;
	object-fit: cover;
	filter: saturate(1.05) contrast(1.05);
}

.card-info {
	padding: 20px;
	text-align: center;
	background: rgba(0, 0, 0, 0.5);
}

.view-btn {
	margin-top: 10px;
	padding: 8px 20px;
	border-radius: 20px;
	border: none;
	background: #fff;
	color: #000;
	font-weight: bold;
	cursor: pointer;
}

.empty-state {
	position: absolute;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	color: rgba(255, 255, 255, 0.8);
	background: rgba(0, 0, 0, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 12px;
	padding: 12px 14px;
	backdrop-filter: blur(10px);
}
</style>