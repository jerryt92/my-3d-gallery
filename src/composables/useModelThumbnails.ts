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
const pending = new Map<string, Promise<string | null>>();

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

async function renderThumbnail(
	modelUrl: string,
	options: Options = {},
): Promise<string | null> {
	if (typeof window === 'undefined' || typeof document === 'undefined') return null;
	if (!window.WebGLRenderingContext) return null;

	const width = options.width ?? 512;
	const height = options.height ?? 512;
	const pixelRatio = options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2);
	const background = options.background ?? null;

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

	const loader = new GLTFLoader(MANAGER)
		.setCrossOrigin('anonymous')
		.setDRACOLoader(DRACO_LOADER)
		.setKTX2Loader(KTX2_LOADER.detectSupport(renderer))
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
	renderer.dispose();

	return dataUrl;
}

export function useModelThumbnails(options: Options = {}) {
	const get = (modelUrl: string) => memoryCache.get(modelUrl) ?? null;

	const ensure = (modelUrl: string) => {
		if (memoryCache.has(modelUrl)) return pending.get(modelUrl) ?? Promise.resolve(get(modelUrl));
		if (pending.has(modelUrl)) return pending.get(modelUrl)!;

		const p = renderThumbnail(modelUrl, options)
			.then((dataUrl) => {
				memoryCache.set(modelUrl, dataUrl);
				return dataUrl;
			})
			.catch((err) => {
				console.warn('[thumbnail] failed:', modelUrl, err);
				memoryCache.set(modelUrl, null);
				return null;
			})
			.finally(() => {
				pending.delete(modelUrl);
			});

		pending.set(modelUrl, p);
		return p;
	};

	return { get, ensure };
}

