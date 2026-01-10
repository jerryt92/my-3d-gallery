import {
	AmbientLight,
	Box3,
	Color,
	DirectionalLight,
	LoadingManager,
	PerspectiveCamera,
	REVISION,
	Scene,
	Vector3,
	WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

type Options = {
	width?: number;
	height?: number;
	background?: string | null;
	pixelRatio?: number;
	/**
	 * 缩略图生成比较吃主线程（glb 解析/纹理上传/toDataURL）。
	 * 默认用 idle 调度 + 单通道队列，尽量不影响 Swiper 等交互。
	 */
	schedule?: 'idle' | 'immediate';
	/**
	 * 最大并发渲染数。并发越高越容易卡顿/触发 WebGL 上下文限制。
	 * 建议保持 1。
	 */
	maxConcurrent?: number;
};

const MANAGER = new LoadingManager();
const THREE_PATH = `https://unpkg.com/three@0.${REVISION}.x`;

const DRACO_LOADER = new DRACOLoader(MANAGER).setDecoderPath(
	`${THREE_PATH}/examples/jsm/libs/draco/gltf/`,
);

const KTX2_LOADER = new KTX2Loader(MANAGER).setTranscoderPath(
	`${THREE_PATH}/examples/jsm/libs/basis/`,
);

const memoryCache = new Map<string, string | null>();
type PendingEntry = {
	promise: Promise<string | null>;
	resolve: (value: string | null) => void;
	reject: (reason?: unknown) => void;
};
const pending = new Map<string, PendingEntry>();

function runWhenIdle(cb: () => void, timeoutMs = 1000) {
	// requestIdleCallback 能让浏览器把这类“后台任务”放到空闲时执行，减少交互卡顿
	const ric = (window as any).requestIdleCallback as
		| ((fn: (deadline: { timeRemaining: () => number; didTimeout: boolean }) => void, opts?: any) => number)
		| undefined;
	if (typeof ric === 'function') {
		return ric(
			() => cb(),
			{ timeout: timeoutMs }, // 即使不“空闲”，也会在超时后执行，避免永远不生成
		);
	}
	// Safari / 旧浏览器 fallback
	return window.setTimeout(cb, 0);
}

function resolveModelUrl(modelUrl: string): string {
	const u = String(modelUrl || '').trim();
	if (!u) return u;
	if (u.startsWith('http://') || u.startsWith('https://')) return u;
	if (u.startsWith('/')) return u;
	if (u.startsWith('./') || u.startsWith('../')) return u;

	// If the url already includes a path (e.g. "models/x.glb"), anchor it to BASE_URL.
	if (u.includes('/')) {
		return `${import.meta.env.BASE_URL}${u.replace(/^\/+/, '')}`;
	}
	return `${import.meta.env.BASE_URL === '/' ? '.' : import.meta.env.BASE_URL}/models/${u}`;
}

type SharedRenderer = {
	canvas: HTMLCanvasElement;
	renderer: WebGLRenderer;
	width: number;
	height: number;
	pixelRatio: number;
	background: string | null;
	ktx2Ready: boolean;
};

let shared: SharedRenderer | null = null;

function getSharedRenderer(options: Options): SharedRenderer {
	const width = options.width ?? 512;
	const height = options.height ?? 512;
	const pixelRatio = options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
	const background = options.background ?? null;

	// Reuse a single WebGL context to avoid context churn + repeated capability detection.
	if (!shared) {
		const canvas = document.createElement('canvas');
		canvas.width = Math.floor(width * pixelRatio);
		canvas.height = Math.floor(height * pixelRatio);

		const renderer = new WebGLRenderer({
			canvas,
			antialias: true,
			alpha: background === null,
			preserveDrawingBuffer: true,
		});

		renderer.setSize(width, height, false);
		renderer.setPixelRatio(pixelRatio);

		shared = { canvas, renderer, width, height, pixelRatio, background, ktx2Ready: false };
	}

	// If output settings changed, update renderer/canvas.
	if (
		shared.width !== width ||
		shared.height !== height ||
		shared.pixelRatio !== pixelRatio ||
		shared.background !== background
	) {
		shared.width = width;
		shared.height = height;
		shared.pixelRatio = pixelRatio;
		shared.background = background;
		shared.canvas.width = Math.floor(width * pixelRatio);
		shared.canvas.height = Math.floor(height * pixelRatio);
		shared.renderer.setSize(width, height, false);
		shared.renderer.setPixelRatio(pixelRatio);
		// Note: alpha was decided at renderer creation; background=null仍然可以通过 scene.background = null 实现透明
	}

	return shared;
}

async function renderThumbnail(
	modelUrl: string,
	options: Options = {},
): Promise<string | null> {
	if (typeof window === 'undefined' || typeof document === 'undefined') return null;
	if (!window.WebGLRenderingContext) return null;

	const width = options.width ?? 512;
	const height = options.height ?? 512;
	const background = options.background ?? null;
	const { canvas, renderer } = getSharedRenderer(options);

	const scene = new Scene();
	if (background === null) {
		scene.background = null;
	} else {
		scene.background = new Color(background);
	}

	// Simple studio-ish lighting for thumbnails.
	scene.add(new AmbientLight(0xffffff, 0.9));
	const keyLight = new DirectionalLight(0xffffff, 1.4);
	keyLight.position.set(1, 2, 2);
	scene.add(keyLight);

	const camera = new PerspectiveCamera(50, width / height, 0.01, 1000);

	// KTX2 支持检测里会触发 capability probing；复用 renderer 后只做一次
	if (shared && !shared.ktx2Ready) {
		KTX2_LOADER.detectSupport(renderer);
		shared.ktx2Ready = true;
	}

	const loader = new GLTFLoader(MANAGER)
		.setCrossOrigin('anonymous')
		.setDRACOLoader(DRACO_LOADER)
		.setKTX2Loader(KTX2_LOADER)
		.setMeshoptDecoder(MeshoptDecoder);

	const url = resolveModelUrl(modelUrl);
	const gltf = await loader.loadAsync(url);
	const root = gltf.scene || gltf.scenes?.[0];
	if (!root) return null;

	scene.add(root);

	root.updateMatrixWorld(true);
	const box = new Box3().setFromObject(root);
	const size = box.getSize(new Vector3()).length();
	const center = box.getCenter(new Vector3());

	camera.near = Math.max(size / 100, 0.01);
	camera.far = Math.max(size * 100, 10);
	camera.updateProjectionMatrix();

	camera.position.copy(center);
	camera.position.x += size / 2.0;
	camera.position.y += size / 5.0;
	camera.position.z += size / 2.0;
	camera.lookAt(center);

	renderer.render(scene, camera);

	const dataUrl = canvas.toDataURL('image/png');

	// Best-effort cleanup.
	try {
		root.traverse((node: any) => {
			if (node?.geometry?.dispose) node.geometry.dispose();
			const material = node?.material;
			const materials = Array.isArray(material) ? material : material ? [material] : [];
			materials.forEach((m: any) => {
				if (!m) return;
				Object.values(m).forEach((v: any) => {
					if (v?.isTexture && v?.dispose) v.dispose();
				});
				if (m?.dispose) m.dispose();
			});
		});
	} catch {
		// ignore
	}
	// Keep shared renderer alive for subsequent thumbnails.
	// renderer.dispose();

	return dataUrl;
}

export function useModelThumbnails(options: Options = {}) {
	const get = (modelUrl: string) => memoryCache.get(modelUrl) ?? null;

	const schedule = options.schedule ?? 'idle';
	const maxConcurrent = Math.max(1, options.maxConcurrent ?? 1);

	type Job = { modelUrl: string };
	const queue: Job[] = [];
	let active = 0;

	const pump = () => {
		while (active < maxConcurrent && queue.length) {
			const job = queue.shift()!;
			const modelUrl = job.modelUrl;
			const entry = pending.get(modelUrl);
			if (!entry) continue; // 已被清理/取消
			active++;

			const run = async () => {
				if (schedule === 'idle') {
					await new Promise<void>((r) => runWhenIdle(() => r(), 1200));
				}
				return renderThumbnail(modelUrl, options);
			};

			run()
				.then((dataUrl) => {
					memoryCache.set(modelUrl, dataUrl);
					entry.resolve(dataUrl);
				})
				.catch((err) => {
					console.warn('[thumbnail] failed:', modelUrl, err);
					memoryCache.set(modelUrl, null);
					entry.resolve(null);
				})
				.finally(() => {
					pending.delete(modelUrl);
					active--;
					pump();
				});
		}
	};

	const ensure = (modelUrl: string) => {
		if (memoryCache.has(modelUrl)) return pending.get(modelUrl)?.promise ?? Promise.resolve(get(modelUrl));
		if (pending.has(modelUrl)) return pending.get(modelUrl)!.promise;

		let resolveFn!: (v: string | null) => void;
		let rejectFn!: (e: unknown) => void;
		const promise = new Promise<string | null>((resolve, reject) => {
			resolveFn = resolve;
			rejectFn = reject;
		});

		pending.set(modelUrl, { promise, resolve: resolveFn, reject: rejectFn });
		queue.push({ modelUrl });
		pump();

		return promise;
	};

	return { get, ensure };
}

