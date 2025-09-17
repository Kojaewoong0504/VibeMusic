/**
 * 컴포넌트 지연 로딩 유틸리티
 *
 * 번들 크기 최적화를 위한 컴포넌트 동적 임포트 지원
 */
import { lazy, ComponentType, Suspense, ReactNode } from 'react'

// 로딩 스피너 컴포넌트
const DefaultLoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
  </div>
)

// 에러 경계 컴포넌트
interface LazyErrorBoundaryProps {
  children: ReactNode
  fallback?: ComponentType<{ error: Error }>
}

class LazyErrorBoundary extends React.Component<
  LazyErrorBoundaryProps,
  { hasError: boolean; error?: Error }
> {
  constructor(props: LazyErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Lazy loading error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error!} />
    }

    return this.props.children
  }
}

const DefaultErrorFallback = ({ error }: { error: Error }) => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-red-600 mb-4">컴포넌트 로딩 실패</h1>
      <p className="text-gray-600 mb-4">페이지를 새로고침해주세요.</p>
      <button
        onClick={() => window.location.reload()}
        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
      >
        새로고침
      </button>
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500">
            에러 세부사항
          </summary>
          <pre className="mt-2 text-xs text-red-500 overflow-auto">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  </div>
)

interface LazyLoadOptions {
  /** 로딩 중 표시할 컴포넌트 */
  loading?: ComponentType
  /** 에러 시 표시할 컴포넌트 */
  errorFallback?: ComponentType<{ error: Error }>
  /** 지연 시간 (ms) - 너무 빠른 로딩으로 인한 깜빡임 방지 */
  delay?: number
  /** 리트라이 횟수 */
  retries?: number
}

/**
 * 컴포넌트를 지연 로딩으로 래핑
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): ComponentType<React.ComponentProps<T>> {
  const {
    loading: LoadingComponent = DefaultLoadingSpinner,
    errorFallback,
    delay = 200,
    retries = 3
  } = options

  // 재시도 로직이 포함된 import 함수
  const importWithRetries = async (
    retriesLeft: number = retries
  ): Promise<{ default: T }> => {
    try {
      // 최소 지연 시간 적용 (깜빡임 방지)
      const [moduleResult] = await Promise.all([
        importFunc(),
        new Promise(resolve => setTimeout(resolve, delay))
      ])
      return moduleResult
    } catch (error) {
      if (retriesLeft > 0) {
        console.warn(`컴포넌트 로딩 실패, 재시도 중... (${retriesLeft}회 남음)`)
        // 지수 백오프로 재시도
        await new Promise(resolve =>
          setTimeout(resolve, (retries - retriesLeft + 1) * 1000)
        )
        return importWithRetries(retriesLeft - 1)
      }
      throw error
    }
  }

  const LazyComponent = lazy(() => importWithRetries())

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <LazyErrorBoundary fallback={errorFallback}>
        <Suspense fallback={<LoadingComponent />}>
          <LazyComponent {...props} />
        </Suspense>
      </LazyErrorBoundary>
    )
  }
}

/**
 * 페이지 레벨 지연 로딩 (더 긴 로딩 시간 허용)
 */
export function lazyLoadPage<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: Omit<LazyLoadOptions, 'delay'> & { delay?: number } = {}
): ComponentType<React.ComponentProps<T>> {
  return lazyLoad(importFunc, {
    delay: 0, // 페이지는 즉시 로딩 표시
    ...options
  })
}

/**
 * 컴포넌트 청크별 지연 로딩
 */
export function lazyLoadChunk<T extends ComponentType<any>>(
  chunkName: string,
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): ComponentType<React.ComponentProps<T>> {
  // 청크명을 포함한 에러 메시지
  const enhancedImportFunc = async () => {
    try {
      return await importFunc()
    } catch (error) {
      console.error(`청크 로딩 실패: ${chunkName}`, error)
      throw error
    }
  }

  return lazyLoad(enhancedImportFunc, options)
}

/**
 * 프리로딩 유틸리티
 */
export class ComponentPreloader {
  private static cache = new Map<string, Promise<any>>()

  /**
   * 컴포넌트 미리 로딩
   */
  static preload<T>(
    key: string,
    importFunc: () => Promise<{ default: T }>
  ): Promise<{ default: T }> {
    if (!this.cache.has(key)) {
      this.cache.set(key, importFunc())
    }
    return this.cache.get(key)!
  }

  /**
   * 라우트 기반 프리로딩
   */
  static preloadRoute(routePath: string) {
    // 라우트 경로에 따른 컴포넌트 프리로딩
    const routeLoaders: Record<string, () => Promise<any>> = {
      '/': () => import('@/pages/MainPage'),
      '/music-generation': () => import('@/pages/MusicGenerationPage'),
      '/result': () => import('@/pages/ResultPage'),
    }

    const loader = routeLoaders[routePath]
    if (loader) {
      this.preload(routePath, loader)
    }
  }

  /**
   * 마우스 호버 시 프리로딩
   */
  static onHover(routePath: string) {
    return {
      onMouseEnter: () => this.preloadRoute(routePath),
      onFocus: () => this.preloadRoute(routePath),
    }
  }

  /**
   * Intersection Observer를 이용한 뷰포트 진입 시 프리로딩
   */
  static onViewportEnter(
    routePath: string,
    threshold: number = 0.1
  ): (element: HTMLElement | null) => void {
    return (element: HTMLElement | null) => {
      if (!element) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.preloadRoute(routePath)
              observer.unobserve(element)
            }
          })
        },
        { threshold }
      )

      observer.observe(element)
    }
  }
}

export default lazyLoad