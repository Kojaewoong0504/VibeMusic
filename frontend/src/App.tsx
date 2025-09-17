import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import MainPage from '@/pages/MainPage'
import MusicGenerationPage from '@/pages/MusicGenerationPage'
import ResultPage from '@/pages/ResultPage'
import { useTheme, getInitialTheme } from '@/hooks/useTheme'
import ThemeToggle from '@/components/ThemeToggle'
import { SkipLink } from '@/hooks/useKeyboardNavigation'

function App() {
  const { effectiveTheme, colors } = useTheme()

  // 초기 테마 설정을 위한 HTML 클래스 적용
  useEffect(() => {
    const initialTheme = getInitialTheme()
    document.documentElement.classList.add(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  return (
    <>
      {/* 접근성: Skip Links */}
      <SkipLink href="#main-content">
        메인 콘텐츠로 바로가기
      </SkipLink>
      <SkipLink href="#navigation">
        내비게이션으로 바로가기
      </SkipLink>

      <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200">
        {/* 테마 토글 버튼 */}
        <header className="fixed top-4 right-4 z-50">
          <div id="navigation">
            <ThemeToggle
              variant="dropdown"
              size="md"
              className="shadow-lg"
              aria-label="테마 변경"
            />
          </div>
        </header>

        {/* 그라데이션 배경 */}
        <div
          className="fixed inset-0 opacity-50 pointer-events-none"
          style={{
            background: effectiveTheme === 'dark'
              ? `linear-gradient(135deg, ${colors.brand[900]} 0%, ${colors.background.secondary} 100%)`
              : `linear-gradient(135deg, ${colors.brand[50]} 0%, ${colors.background.accent} 100%)`
          }}
        />

        {/* 메인 콘텐츠 */}
        <main id="main-content" className="relative z-10">
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/generate" element={<MusicGenerationPage />} />
            <Route path="/result/:musicId" element={<ResultPage />} />
          </Routes>
        </main>
      </div>
    </>
  )
}

export default App