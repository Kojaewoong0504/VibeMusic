/**
 * 최적화된 라우터 설정
 *
 * 코드 스플리팅과 지연 로딩을 적용한 라우터
 */
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { lazyLoadPage, ComponentPreloader } from '@/utils/lazyLoad'

// 페이지 컴포넌트 지연 로딩
const MainPage = lazyLoadPage(() => import('@/pages/MainPage'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">메인 페이지 로딩 중...</p>
      </div>
    </div>
  )
})

const MusicGenerationPage = lazyLoadPage(() => import('@/pages/MusicGenerationPage'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto mb-4"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 mx-auto mb-4"></div>
          <div className="h-8 bg-gray-300 rounded w-1/4 mx-auto"></div>
        </div>
        <p className="text-gray-600 mt-4">음악 생성 페이지 준비 중...</p>
      </div>
    </div>
  )
})

const ResultPage = lazyLoadPage(() => import('@/pages/ResultPage'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-bounce">
          <div className="w-12 h-12 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <div className="w-6 h-6 bg-indigo-600 rounded-full"></div>
          </div>
        </div>
        <p className="text-gray-600">결과 페이지 로딩 중...</p>
      </div>
    </div>
  )
})

// 에러 페이지 (즉시 로딩)
const ErrorPage = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-8">페이지를 찾을 수 없습니다</p>
      <div className="space-x-4">
        <a
          href="/"
          className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          홈으로 돌아가기
        </a>
        <button
          onClick={() => window.history.back()}
          className="inline-block px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          이전 페이지
        </button>
      </div>
    </div>
  </div>
)

// 라우터 설정
export const optimizedRouter = createBrowserRouter([
  {
    path: '/',
    element: <MainPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/music-generation',
    element: <MusicGenerationPage />,
    errorElement: <ErrorPage />,
  },
  {
    path: '/result/:sessionId?',
    element: <ResultPage />,
    errorElement: <ErrorPage />,
  },
  // 레거시 경로 리다이렉트
  {
    path: '/home',
    element: <Navigate to="/" replace />,
  },
  {
    path: '/generate',
    element: <Navigate to="/music-generation" replace />,
  },
  // 404 처리
  {
    path: '*',
    element: <ErrorPage />,
  },
])

// 라우터 프로바이더 컴포넌트
export function OptimizedRouterProvider() {
  return <RouterProvider router={optimizedRouter} />
}

// 라우트 프리로딩 훅
export function useRoutePreloading() {
  const preloadRoute = (routePath: string) => {
    ComponentPreloader.preloadRoute(routePath)
  }

  const getPreloadProps = (routePath: string) => {
    return ComponentPreloader.onHover(routePath)
  }

  return {
    preloadRoute,
    getPreloadProps,
  }
}

export default OptimizedRouterProvider