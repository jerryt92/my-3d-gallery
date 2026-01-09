<template>
	<div class="preview-page">
		<div class="background-blur" :style="{ backgroundImage: `url(${activeBg})` }"></div>

		<header class="gallery-header">
			<h1>3D Model Library</h1>
			<p>Select a model to view in AR/3D</p>
		</header>

		<div class="swiper-container">
			<swiper
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
				<swiper-slide v-for="entry in displayModels" :key="entry.id">
					<div class="model-card" @click="goToViewer(entry.modelUrl)">
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
				</swiper-slide>
			</swiper>
			<div v-if="!isLoading && displayModels.length === 0" class="empty-state">
				No models found. Check `public/models/info.json`.
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { Swiper, SwiperSlide } from 'swiper/vue';
import { EffectCoverflow, Keyboard, Mousewheel } from 'swiper/modules';
// 导入 Swiper 样式
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import { useModelThumbnails } from '@/composables/useModelThumbnails';

const router = useRouter();
const isLoading = ref(false);
const modelsData = ref<Record<string, any>>({});
const activeIndex = ref(0);
const thumbs = ref<Record<string, string | null>>({});

const { ensure: ensureThumb } = useModelThumbnails({
	width: 512,
	height: 512,
	background: null,
});

// 获取并过滤数据
onMounted(async () => {
	try {
		isLoading.value = true;
		const res = await fetch(`${import.meta.env.BASE_URL === '/' ? '.' : import.meta.env.BASE_URL}/models/info.json`);
		const data = await res.json();
		modelsData.value = data;
	} catch (e) {
		console.error("Failed to load models info", e);
	} finally {
		isLoading.value = false;
	}
});

type DisplayModel = { id: string; name: string; modelUrl: string };

const displayModels = computed<DisplayModel[]>(() => {
	// `public/models/info.json` doesn't always have `show`.
	// Default to show unless explicitly set to false.
	const byUrl = new Map<string, DisplayModel>();

	for (const [key, raw] of Object.entries(modelsData.value || {})) {
		if (raw && raw.show === false) continue;

		const modelUrl = String((raw && raw.url) || key);
		const looksLikeModel =
			modelUrl.startsWith('http') ||
			modelUrl.endsWith('.glb') ||
			modelUrl.endsWith('.gltf');
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
		models.forEach((m) => {
			if (thumbs.value[m.modelUrl] !== undefined) return;
			thumbs.value[m.modelUrl] = null;
			ensureThumb(m.modelUrl).then((dataUrl) => {
				if (dataUrl) thumbs.value[m.modelUrl] = dataUrl;
			});
		});
	},
	{ immediate: true },
);

const onSlideChange = (swiper) => {
	activeIndex.value = swiper.activeIndex;
};

const goToViewer = (modelUrl: string) => {
	// Web History 模式下，使用 query 参数传递模型路径
	// URL 格式: /viewer?model=xxx
	router.push({ 
		path: '/viewer', 
		query: { model: modelUrl } 
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
	top: 0; left: 0; right: 0; bottom: 0;
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