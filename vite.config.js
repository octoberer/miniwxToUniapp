import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        open: true, // 自动打开浏览器
    },
    build: {
        outDir: 'dist', // 输出文件夹
        rollupOptions: {
            input: 'index.html', // 入口 HTML 文件
        },
    },
})
