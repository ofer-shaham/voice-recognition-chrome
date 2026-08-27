import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5000,
        host: '0.0.0.0',
        strictPort: true,
        allowedHosts: true,
        proxy: {
            '/api': {
                target: process.env.API_PROXY_TARGET || 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'build',
    },
});
