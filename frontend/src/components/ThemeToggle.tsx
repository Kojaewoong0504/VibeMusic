/**
 * Theme Toggle Component
 *
 * T095: 다크 모드 구현
 * - 라이트/다크/자동 모드 전환
 * - 애니메이션 효과
 * - 접근성 준수
 * - 키보드 네비게이션
 */
import React, { useState } from 'react';
import { Sun, Moon, Monitor, Palette } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown' | 'segmented';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  variant = 'icon',
  size = 'md',
  showLabel = false,
  className = ''
}) => {
  const { mode, effectiveTheme, setTheme, toggleTheme, systemPrefersDark } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 키보드 내비게이션
  useKeyboardNavigation({
    enabled: isDropdownOpen,
    trapFocus: true,
    onEscape: () => setIsDropdownOpen(false),
    onEnter: (element) => {
      const themeMode = element.getAttribute('data-theme-mode');
      if (themeMode) {
        setTheme(themeMode as any);
        setIsDropdownOpen(false);
      }
    }
  });

  // 크기별 스타일
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg'
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24
  };

  // 테마 정보
  const themes = [
    {
      mode: 'light' as const,
      label: '라이트 모드',
      icon: Sun,
      description: '밝은 테마'
    },
    {
      mode: 'dark' as const,
      label: '다크 모드',
      icon: Moon,
      description: '어두운 테마'
    },
    {
      mode: 'auto' as const,
      label: '시스템 모드',
      icon: Monitor,
      description: systemPrefersDark ? '다크 (시스템)' : '라이트 (시스템)'
    }
  ];

  // 현재 테마 정보
  const currentTheme = themes.find(t => t.mode === mode) || themes[0];
  const CurrentIcon = currentTheme.icon;

  // 아이콘 버튼 렌더링
  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className={`
          ${sizeClasses[size]} ${className}
          inline-flex items-center justify-center
          rounded-lg
          bg-transparent
          text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100
          hover:bg-gray-100 dark:hover:bg-gray-800
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
          transition-all duration-200
          active:scale-95
        `.replace(/\s+/g, ' ').trim()}
        aria-label={`현재: ${currentTheme.label}. 클릭하여 테마 변경`}
        title={currentTheme.label}
      >
        <div className="relative">
          <CurrentIcon
            size={iconSizes[size]}
            className={`
              transform transition-all duration-300
              ${effectiveTheme === 'dark' ? 'rotate-180' : 'rotate-0'}
            `}
          />

          {/* 테마 전환 애니메이션 효과 */}
          {mode === 'auto' && (
            <div className="absolute -top-1 -right-1 w-2 h-2">
              <div className="w-full h-full bg-blue-500 rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {showLabel && (
          <span className="ml-2 text-sm font-medium">
            {currentTheme.label}
          </span>
        )}
      </button>
    );
  }

  // 드롭다운 버튼 렌더링
  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`
            ${sizeClasses[size]} ${className}
            inline-flex items-center justify-center
            rounded-lg border border-gray-300 dark:border-gray-600
            bg-white dark:bg-gray-800
            text-gray-700 dark:text-gray-300
            hover:bg-gray-50 dark:hover:bg-gray-700
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
            transition-all duration-200
          `.replace(/\s+/g, ' ').trim()}
          aria-label="테마 선택 메뉴 열기"
          aria-expanded={isDropdownOpen}
          aria-haspopup="true"
        >
          <CurrentIcon size={iconSizes[size]} />
          {showLabel && (
            <span className="ml-2 text-sm font-medium">
              {currentTheme.label}
            </span>
          )}
          <Palette size={12} className="ml-1 opacity-50" />
        </button>

        {/* 드롭다운 메뉴 */}
        {isDropdownOpen && (
          <>
            {/* 오버레이 */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsDropdownOpen(false)}
              aria-hidden="true"
            />

            {/* 메뉴 */}
            <div
              className="
                absolute right-0 top-full mt-2 z-20
                w-48 py-1
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-gray-700
                rounded-lg shadow-lg
                focus:outline-none
              "
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="theme-menu-button"
            >
              {themes.map((theme) => {
                const Icon = theme.icon;
                const isActive = theme.mode === mode;

                return (
                  <button
                    key={theme.mode}
                    onClick={() => {
                      setTheme(theme.mode);
                      setIsDropdownOpen(false);
                    }}
                    data-theme-mode={theme.mode}
                    className={`
                      w-full px-4 py-2 text-left text-sm
                      flex items-center space-x-3
                      ${isActive
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }
                      transition-colors duration-150
                    `.replace(/\s+/g, ' ').trim()}
                    role="menuitem"
                  >
                    <Icon size={16} />
                    <div className="flex-1">
                      <div className="font-medium">{theme.label}</div>
                      <div className="text-xs opacity-60">{theme.description}</div>
                    </div>
                    {isActive && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // 세그먼트 컨트롤 렌더링
  if (variant === 'segmented') {
    return (
      <div
        className={`
          ${className}
          inline-flex items-center
          p-1 space-x-1
          bg-gray-100 dark:bg-gray-800
          rounded-lg
        `.replace(/\s+/g, ' ').trim()}
        role="radiogroup"
        aria-label="테마 선택"
      >
        {themes.map((theme) => {
          const Icon = theme.icon;
          const isActive = theme.mode === mode;

          return (
            <button
              key={theme.mode}
              onClick={() => setTheme(theme.mode)}
              className={`
                ${sizeClasses[size]}
                inline-flex items-center justify-center
                rounded-md
                text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-100 dark:focus:ring-offset-gray-800
              `.replace(/\s+/g, ' ').trim()}
              role="radio"
              aria-checked={isActive}
              aria-label={theme.label}
              title={theme.description}
            >
              <Icon size={iconSizes[size]} />
              {showLabel && (
                <span className="ml-2">{theme.label}</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
};

export default ThemeToggle;