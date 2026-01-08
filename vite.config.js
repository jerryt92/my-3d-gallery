import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    // 加载当前环境的变量（比如 .env.production 中的内容）
    const env = loadEnv(mode, process.cwd(), '');

    return {
        // 读取变量中的 VITE_BASE，如果没有（比如本地开发）则默认使用 '/'
        base: env.VITE_BASE || '/',

        // 你的项目看起来是原生 JS，通常不需要额外插件
        // 如果以后需要配置打包输出目录等，也可以写在这里
        build: {
            outDir: 'dist',
        }
    };
});