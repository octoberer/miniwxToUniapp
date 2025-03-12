// import { defineConfig } from 'vite'

// export default defineConfig({
//     server: {
//         open: true, // 自动打开浏览器
//     },
//     build: {
//         outDir: 'dist', // 输出文件夹
//         rollupOptions: {
//             input: 'index.html', // 入口 HTML 文件
//         },
//     },
// })

import { defineConfig } from 'vite';
import terser from '@rollup/plugin-terser';

export default defineConfig({
    build: {
        lib: {
            entry: './index.ts', // 你的入口文件
            name: 'covertor', // 导出的全局变量名（适用于 UMD）
            fileName: `covertor`, // 生成的文件名
            formats: ['cjs'], // 设置 CommonJS 格式
        },
        rollupOptions: {
            output: {
                globals: {
                    vue: 'Vue', // 如果你的库依赖 Vue，可以在这里指定全局变量
                },
            },
            plugins: process.env.NODE_ENV === 'production' ? [
                terser({
                    compress: {
                        drop_console: true,
                    },
                }),
            ] : [],
        },
    },
});

