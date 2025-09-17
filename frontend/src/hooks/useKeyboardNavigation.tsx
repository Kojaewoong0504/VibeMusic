/**
 * Keyboard Navigation Hook
 *
 * T094: 접근성 최종 검증 - 키보드 네비게이션
 * - Tab/Shift+Tab 네비게이션
 * - Enter/Space 활성화
 * - ESC 키로 모달/메뉴 닫기
 * - 화살표 키 네비게이션
 */
import { useEffect, useCallback, useRef } from 'react';

interface KeyboardNavigationOptions {
  enabled?: boolean;
  trapFocus?: boolean; // 포커스 트랩 (모달용)
  rootElement?: Element | null;
  onEscape?: () => void;
  onEnter?: (element: Element) => void;
  onFocusChange?: (element: Element | null) => void;
}

interface FocusableElement extends Element {
  tabIndex: number;
  focus(): void;
  blur(): void;
}

export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enabled = true,
    trapFocus = false,
    rootElement = null,
    onEscape,
    onEnter,
    onFocusChange
  } = options;

  const lastFocusedElement = useRef<Element | null>(null);
  const focusableElements = useRef<FocusableElement[]>([]);

  // 포커스 가능한 요소 선택자
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    'audio[controls]',
    'video[controls]',
    'summary',
    'iframe'
  ].join(', ');

  // 포커스 가능한 요소들 찾기
  const getFocusableElements = useCallback((): FocusableElement[] => {
    const container = rootElement || document.body;
    const elements = Array.from(
      container.querySelectorAll(focusableSelectors)
    ) as FocusableElement[];

    // 화면에 보이는 요소만 필터링
    return elements.filter(element => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);

      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        !element.hasAttribute('inert')
      );
    });
  }, [rootElement]);

  // 첫 번째 포커스 가능한 요소로 이동
  const focusFirst = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      elements[0].focus();
      onFocusChange?.(elements[0]);
    }
  }, [getFocusableElements, onFocusChange]);

  // 마지막 포커스 가능한 요소로 이동
  const focusLast = useCallback(() => {
    const elements = getFocusableElements();
    if (elements.length > 0) {
      const lastElement = elements[elements.length - 1];
      lastElement.focus();
      onFocusChange?.(lastElement);
    }
  }, [getFocusableElements, onFocusChange]);

  // 다음 요소로 포커스 이동
  const focusNext = useCallback((currentElement?: Element) => {
    const elements = getFocusableElements();
    const current = currentElement || document.activeElement;

    if (!current || elements.length === 0) {
      focusFirst();
      return;
    }

    const currentIndex = elements.indexOf(current as FocusableElement);

    if (currentIndex === -1) {
      focusFirst();
      return;
    }

    const nextIndex = (currentIndex + 1) % elements.length;
    elements[nextIndex].focus();
    onFocusChange?.(elements[nextIndex]);
  }, [getFocusableElements, focusFirst, onFocusChange]);

  // 이전 요소로 포커스 이동
  const focusPrevious = useCallback((currentElement?: Element) => {
    const elements = getFocusableElements();
    const current = currentElement || document.activeElement;

    if (!current || elements.length === 0) {
      focusLast();
      return;
    }

    const currentIndex = elements.indexOf(current as FocusableElement);

    if (currentIndex === -1) {
      focusLast();
      return;
    }

    const prevIndex = currentIndex === 0 ? elements.length - 1 : currentIndex - 1;
    elements[prevIndex].focus();
    onFocusChange?.(elements[prevIndex]);
  }, [getFocusableElements, focusLast, onFocusChange]);

  // 특정 인덱스의 요소로 포커스 이동
  const focusIndex = useCallback((index: number) => {
    const elements = getFocusableElements();
    if (index >= 0 && index < elements.length) {
      elements[index].focus();
      onFocusChange?.(elements[index]);
    }
  }, [getFocusableElements, onFocusChange]);

  // 포커스 트랩 처리
  const handleFocusTrap = useCallback((event: FocusEvent) => {
    if (!trapFocus) return;

    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const firstElement = elements[0];
    const lastElement = elements[elements.length - 1];
    const targetElement = event.target as Element;

    // 컨테이너 밖으로 포커스가 나가려고 할 때 트랩
    const container = rootElement || document.body;
    if (!container.contains(targetElement)) {
      event.preventDefault();
      firstElement.focus();
      return;
    }

    // 마지막 요소에서 Tab을 눌렀을 때 첫 번째로
    if (targetElement === lastElement && !event.shiftKey) {
      // Tab을 감지하기 위해 keydown 이벤트에서 처리
    }

    // 첫 번째 요소에서 Shift+Tab을 눌렀을 때 마지막으로
    if (targetElement === firstElement && event.shiftKey) {
      // Shift+Tab을 감지하기 위해 keydown 이벤트에서 처리
    }
  }, [trapFocus, rootElement, getFocusableElements]);

  // 키보드 이벤트 핸들러
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    const { key, shiftKey, ctrlKey, altKey, metaKey } = event;
    const activeElement = document.activeElement as Element;

    // 수정자 키가 눌린 경우 기본 처리
    if (ctrlKey || altKey || metaKey) return;

    switch (key) {
      case 'Tab':
        if (trapFocus) {
          const elements = getFocusableElements();
          if (elements.length === 0) {
            event.preventDefault();
            return;
          }

          const firstElement = elements[0];
          const lastElement = elements[elements.length - 1];

          if (shiftKey && activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
            onFocusChange?.(lastElement);
          } else if (!shiftKey && activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
            onFocusChange?.(firstElement);
          }
        }
        break;

      case 'Enter':
        // Enter 키로 버튼/링크 활성화
        if (activeElement && (
          activeElement.tagName === 'BUTTON' ||
          activeElement.tagName === 'A' ||
          activeElement.getAttribute('role') === 'button' ||
          activeElement.getAttribute('role') === 'link'
        )) {
          onEnter?.(activeElement);
        }
        break;

      case ' ':
      case 'Space':
        // Space 키로 버튼 활성화 (체크박스, 라디오 제외)
        if (activeElement &&
            activeElement.tagName === 'BUTTON' ||
            activeElement.getAttribute('role') === 'button') {
          event.preventDefault();
          onEnter?.(activeElement);
        }
        break;

      case 'Escape':
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        break;

      case 'Home':
        // 첫 번째 요소로 이동
        if (trapFocus) {
          event.preventDefault();
          focusFirst();
        }
        break;

      case 'End':
        // 마지막 요소로 이동
        if (trapFocus) {
          event.preventDefault();
          focusLast();
        }
        break;

      case 'ArrowUp':
        // 세로 네비게이션 (리스트, 메뉴 등)
        if (activeElement && (
          activeElement.getAttribute('role') === 'menuitem' ||
          activeElement.getAttribute('role') === 'option' ||
          activeElement.closest('[role="menu"]') ||
          activeElement.closest('[role="listbox"]')
        )) {
          event.preventDefault();
          focusPrevious();
        }
        break;

      case 'ArrowDown':
        // 세로 네비게이션 (리스트, 메뉴 등)
        if (activeElement && (
          activeElement.getAttribute('role') === 'menuitem' ||
          activeElement.getAttribute('role') === 'option' ||
          activeElement.closest('[role="menu"]') ||
          activeElement.closest('[role="listbox"]')
        )) {
          event.preventDefault();
          focusNext();
        }
        break;

      case 'ArrowLeft':
        // 가로 네비게이션 (탭, 라디오 그룹 등)
        if (activeElement && (
          activeElement.getAttribute('role') === 'tab' ||
          activeElement.getAttribute('type') === 'radio' ||
          activeElement.closest('[role="tablist"]') ||
          activeElement.closest('[role="radiogroup"]')
        )) {
          event.preventDefault();
          focusPrevious();
        }
        break;

      case 'ArrowRight':
        // 가로 네비게이션 (탭, 라디오 그룹 등)
        if (activeElement && (
          activeElement.getAttribute('role') === 'tab' ||
          activeElement.getAttribute('type') === 'radio' ||
          activeElement.closest('[role="tablist"]') ||
          activeElement.closest('[role="radiogroup"]')
        )) {
          event.preventDefault();
          focusNext();
        }
        break;
    }
  }, [
    enabled,
    trapFocus,
    getFocusableElements,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    onEscape,
    onEnter,
    onFocusChange
  ]);

  // 포커스 변경 감지
  const handleFocusIn = useCallback((event: FocusEvent) => {
    const element = event.target as Element;
    if (element !== lastFocusedElement.current) {
      lastFocusedElement.current = element;
      onFocusChange?.(element);
    }
  }, [onFocusChange]);

  // 이벤트 리스너 등록
  useEffect(() => {
    if (!enabled) return;

    const container = rootElement || document;

    container.addEventListener('keydown', handleKeyDown as EventListener);
    container.addEventListener('focusin', handleFocusIn as EventListener);

    if (trapFocus) {
      document.addEventListener('focusin', handleFocusTrap as EventListener);
    }

    // 포커스 가능한 요소 목록 업데이트
    focusableElements.current = getFocusableElements();

    return () => {
      container.removeEventListener('keydown', handleKeyDown as EventListener);
      container.removeEventListener('focusin', handleFocusIn as EventListener);

      if (trapFocus) {
        document.removeEventListener('focusin', handleFocusTrap as EventListener);
      }
    };
  }, [
    enabled,
    rootElement,
    trapFocus,
    handleKeyDown,
    handleFocusIn,
    handleFocusTrap,
    getFocusableElements
  ]);

  // 포커스 복원 기능
  const restoreFocus = useCallback(() => {
    if (lastFocusedElement.current && typeof (lastFocusedElement.current as any).focus === 'function') {
      (lastFocusedElement.current as FocusableElement).focus();
    }
  }, []);

  // 포커스를 특정 요소로 설정
  const setFocus = useCallback((element: Element | string) => {
    let targetElement: Element | null = null;

    if (typeof element === 'string') {
      targetElement = document.querySelector(element);
    } else {
      targetElement = element;
    }

    if (targetElement && typeof (targetElement as any).focus === 'function') {
      (targetElement as FocusableElement).focus();
      onFocusChange?.(targetElement);
    }
  }, [onFocusChange]);

  return {
    // 포커스 제어
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    focusIndex,
    setFocus,
    restoreFocus,

    // 상태
    focusableElements: focusableElements.current,
    currentFocus: lastFocusedElement.current,

    // 유틸리티
    getFocusableElements,
  };
}

// Skip Link 컴포넌트 (접근성 향상)
interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export function SkipLink({ href, children, className = '' }: SkipLinkProps) {
  const defaultClasses = `
    absolute -translate-y-full opacity-0
    focus:translate-y-0 focus:opacity-100
    bg-blue-600 text-white px-4 py-2 rounded
    transition-all duration-200 z-50
  `.replace(/\s+/g, ' ').trim();

  return (
    <a
      href={href}
      className={`${defaultClasses} ${className}`}
      onFocus={(e) => {
        // 스킵 링크가 포커스를 받으면 자동으로 보이게
        e.target.style.transform = 'translateY(0)';
        e.target.style.opacity = '1';
      }}
      onBlur={(e) => {
        // 포커스를 잃으면 숨기기
        e.target.style.transform = 'translateY(-100%)';
        e.target.style.opacity = '0';
      }}
    >
      {children}
    </a>
  );
}