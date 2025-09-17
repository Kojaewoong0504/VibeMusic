import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'
import { splitVendorChunkPlugin } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'

  return {
    plugins: [
      react({
        // React Fast Refresh 최적화
        fastRefresh: !isProduction,
        // JSX 런타임 최적화
        jsxRuntime: 'automatic',
      }),
      // 벤더 청크 분리 플러그인
      splitVendorChunkPlugin(),
      // 번들 분석기 (프로덕션 빌드 시)
      isProduction &&
        visualizer({
          filename: 'dist/bundle-analyzer.html',
          open: false,
          gzipSize: true,
          brotliSize: true,
        }),
    ].filter(Boolean),

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/pages': path.resolve(__dirname, './src/pages'),
        '@/services': path.resolve(__dirname, './src/services'),
        '@/hooks': path.resolve(__dirname, './src/hooks'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/types': path.resolve(__dirname, '../shared/types'),
        '@/assets': path.resolve(__dirname, './src/assets'),
      },
    },

    // 개발 서버 설정
    server: {
      port: 3000,
      host: true, // 외부 접속 허용
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '/v1'),
        },
        '/ws': {
          target: env.VITE_WS_URL || 'ws://localhost:8000',
          ws: true,
        },
      },
    },

    // 빌드 최적화 설정
    build: {
      outDir: 'dist',
      sourcemap: isProduction ? false : true, // 프로덕션에서는 소스맵 비활성화
      minify: 'terser', // Terser 압축 사용
      target: 'es2020', // 최신 JavaScript 기능 사용

      // 청크 크기 경고 임계값
      chunkSizeWarningLimit: 1000,

      // Terser 옵션
      terserOptions: {
        compress: {
          drop_console: isProduction, // 프로덕션에서 console 제거
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.debug'] : [],
        },
        mangle: {
          safari10: true, // Safari 10 호환성
        },
      },

      // Rollup 옵션 - 코드 스플리팅 최적화
      rollupOptions: {
        output: {
          // 청크 분리 전략
          manualChunks: {
            // React 생태계
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],

            // UI 라이브러리
            'ui-vendor': ['framer-motion', 'lucide-react'],

            // 상태 관리 및 데이터 페칭
            'state-vendor': ['zustand', '@tanstack/react-query'],

            // 폼 및 검증
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],

            // 네트워킹
            'network-vendor': ['axios', 'socket.io-client'],

            // 유틸리티
            'utils-vendor': ['clsx', 'tailwind-merge'],
          },

          // 파일명 패턴
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop()
              : 'chunk'
            return `js/[name]-[hash].js`
          },

          assetFileNames: (assetInfo) => {
            // 파일 확장자에 따른 폴더 분리
            const extType = assetInfo.name?.split('.').at(1) || ''
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              return `images/[name]-[hash][extname]`
            }
            if (/css/i.test(extType)) {
              return `css/[name]-[hash][extname]`
            }
            return `assets/[name]-[hash][extname]`
          },

          entryFileNames: 'js/[name]-[hash].js',
        },

        // 외부 의존성 최적화
        external: [], // 필요 시 CDN 사용할 라이브러리
      },
    },

    // 의존성 사전 번들링 최적화
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        'axios',
        'socket.io-client',
        'framer-motion',
        'zustand',
        'react-hook-form',
        '@hookform/resolvers/zod',
        'zod',
        'clsx',
        'tailwind-merge',
        'lucide-react',
      ],
      // ESM 호환성 강제
      esbuildOptions: {
        target: 'es2020',
      },
    },

    // 성능 개선 설정
    esbuild: {
      // 개발 시 더 빠른 빌드를 위해 압축 비활성화
      minify: isProduction,
      target: 'es2020',
      // JSX factory 최적화
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
    },

    // CSS 설정
    css: {
      devSourcemap: !isProduction,
      postcss: './postcss.config.js',
    },

    // 환경 변수 설정
    define: {
      __DEV__: !isProduction,
      __PROD__: isProduction,
      'process.env.NODE_ENV': JSON.stringify(mode),
    },

    // 미리보기 서버 설정
    preview: {
      port: 3000,
      host: true,
    },
  }
})