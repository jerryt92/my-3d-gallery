import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import fs from 'fs';

export default defineConfig(({ mode }) => {
	// 加载当前环境的变量（比如 ..env 中的内容）
	const env = loadEnv(mode, process.cwd(), '');

	const loadSimpleEnvFile = (filePath: string) => {
		try {
			const text = fs.readFileSync(filePath, 'utf8');
			const out: Record<string, string> = {};
			for (const line of text.split(/\r?\n/)) {
				const trimmed = line.trim();
				if (!trimmed || trimmed.startsWith('#')) continue;
				const idx = trimmed.indexOf('=');
				if (idx <= 0) continue;
				const key = trimmed.slice(0, idx).trim();
				let value = trimmed.slice(idx + 1).trim();
				// strip optional quotes
				if (
					(value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))
				) {
					value = value.slice(1, -1);
				}
				out[key] = value;
			}
			return out;
		} catch {
			return {};
		}
	};

	const normalizeBase = (base: string | undefined) => {
		const b = (base || '').trim();
		if (!b) return '/';
		// Allow absolute URLs and relative bases like './'
		if (b.startsWith('http://') || b.startsWith('https://')) return b;
		if (b.startsWith('/') || b.startsWith('./') || b.startsWith('../')) return b;
		return `/${b}`;
	};

	// If you deploy this app under a sub-path (e.g. GitHub Pages), set the production base here.
	// You can still override it by providing VITE_BASE at build time.
	const defaultProdBase = '/my-3d-gallery/';
	const configEnv =
		mode === 'production'
			? loadSimpleEnvFile(path.resolve(__dirname, './config/.env'))
			: {};

	return {
		// 读取变量中的 VITE_BASE，如果没有（比如本地开发）则默认使用 '/'
		base: normalizeBase(
			env.VITE_BASE ||
				configEnv.VITE_BASE ||
				(mode === 'production' ? defaultProdBase : '/'),
		),

		plugins: [vue()],

		resolve: {
			alias: {
				'@': path.resolve(__dirname, './src'),
			},
		},

		build: {
			outDir: 'dist',
		}
	};
});