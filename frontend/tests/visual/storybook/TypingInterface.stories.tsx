/**
 * TypingInterface Storybook Stories
 *
 * 실시간 타이핑 입력 컴포넌트의 다양한 상태와 상황을 시각적으로 테스트
 */

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import TypingInterface from '../../../src/components/TypingInterface';
import type { Keystroke } from '../../../shared/types/websocket';

const meta: Meta<typeof TypingInterface> = {
  title: 'Components/TypingInterface',
  component: TypingInterface,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: '실시간 타이핑 입력과 감정 분석을 위한 인터페이스 컴포넌트'
      }
    }
  },
  argTypes: {
    prompt: {
      control: 'text',
      description: '사용자에게 표시할 프롬프트 텍스트'
    },
    placeholder: {
      control: 'text',
      description: '입력 필드 플레이스홀더'
    },
    maxLength: {
      control: { type: 'range', min: 100, max: 2000, step: 100 },
      description: '최대 입력 글자 수'
    },
    disabled: {
      control: 'boolean',
      description: '비활성화 상태'
    },
    isActive: {
      control: 'boolean',
      description: '활성 상태 (WebSocket 연결 등)'
    }
  }
};

export default meta;
type Story = StoryObj<typeof meta>;

// 기본 스토리
export const Default: Story = {
  args: {
    prompt: '당신의 감정을 자유롭게 타이핑해보세요...',
    placeholder: '여기에 입력하세요',
    maxLength: 1000,
    disabled: false,
    isActive: true
  }
};

// 인터랙티브 스토리 (실제 타이핑 캡처)
export const Interactive: Story = {
  render: (args) => {
    const [keystrokes, setKeystrokes] = useState<Keystroke[]>([]);
    const [text, setText] = useState('');
    const [stats, setStats] = useState(null);

    return (
      <div className="space-y-4">
        <TypingInterface
          {...args}
          onKeystroke={(keystroke) => {
            setKeystrokes(prev => [...prev.slice(-19), keystroke]);
          }}
          onTextChange={setText}
          onStatsChange={setStats}
        />

        {/* 디버그 정보 */}
        <div className="mt-4 p-4 bg-gray-100 rounded-lg text-sm">
          <h4 className="font-semibold mb-2">실시간 정보</h4>
          <p>텍스트 길이: {text.length}자</p>
          <p>최근 키스트로크: {keystrokes.length}개</p>
          {stats && (
            <div>
              <p>WPM: {stats.wpm}</p>
              <p>평균 간격: {stats.averageInterval}ms</p>
              <p>리듬: {stats.rhythm}</p>
            </div>
          )}
        </div>
      </div>
    );
  },
  args: {
    prompt: '실제로 타이핑해보세요',
    isActive: true
  }
};

// 연결되지 않은 상태
export const Disconnected: Story = {
  args: {
    prompt: '서버에 연결 중입니다...',
    placeholder: '연결 대기 중',
    isActive: false,
    disabled: true
  }
};

// 긴 텍스트로 테스트
export const WithLongText: Story = {
  render: (args) => {
    const [text, setText] = useState(
      '이것은 매우 긴 텍스트 예시입니다. '.repeat(20)
    );

    return (
      <TypingInterface
        {...args}
        onTextChange={setText}
      />
    );
  },
  args: {
    prompt: '긴 텍스트가 이미 입력된 상태',
    maxLength: 1000
  }
};

// 최대 길이 근처
export const NearMaxLength: Story = {
  render: (args) => {
    const nearMaxText = 'a'.repeat(95);
    const [text, setText] = useState(nearMaxText);

    return (
      <TypingInterface
        {...args}
        onTextChange={setText}
      />
    );
  },
  args: {
    prompt: '최대 길이에 가까운 상태',
    maxLength: 100
  }
};

// 다양한 크기
export const Compact: Story = {
  args: {
    prompt: '컴팩트 버전',
    className: 'max-w-md'
  }
};

export const Large: Story = {
  args: {
    prompt: '큰 화면 버전',
    className: 'max-w-4xl'
  }
};

// 다크 테마
export const DarkTheme: Story = {
  decorators: [
    (Story) => (
      <div className="dark bg-gray-900 p-6 rounded-lg">
        <Story />
      </div>
    )
  ],
  args: {
    prompt: '다크 테마에서의 모습',
    className: 'dark-theme'
  }
};

// 에러 상태 시뮬레이션
export const WithErrors: Story = {
  render: (args) => {
    const [showError, setShowError] = useState(false);

    return (
      <div>
        <button
          onClick={() => setShowError(!showError)}
          className="mb-4 px-4 py-2 bg-red-500 text-white rounded"
        >
          에러 토글
        </button>

        <TypingInterface
          {...args}
          disabled={showError}
          className={showError ? 'error-state' : ''}
        />

        {showError && (
          <div className="mt-2 text-red-600 text-sm">
            오류: 타이핑 캡처에 실패했습니다.
          </div>
        )}
      </div>
    );
  },
  args: {
    prompt: '에러 상태 테스트'
  }
};

// 접근성 테스트
export const AccessibilityTest: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true
          },
          {
            id: 'keyboard-navigation',
            enabled: true
          }
        ]
      }
    }
  },
  args: {
    prompt: '접근성 테스트 - 탭과 키보드로 탐색해보세요'
  }
};

// 성능 테스트 (많은 키스트로크)
export const PerformanceTest: Story = {
  render: (args) => {
    const [eventCount, setEventCount] = useState(0);

    const handleKeystroke = () => {
      setEventCount(prev => prev + 1);
    };

    return (
      <div>
        <div className="mb-4 text-sm text-gray-600">
          키스트로크 이벤트 수: {eventCount}
        </div>

        <TypingInterface
          {...args}
          onKeystroke={handleKeystroke}
        />

        <div className="mt-4 text-xs text-gray-500">
          빠르게 타이핑해서 성능을 테스트해보세요
        </div>
      </div>
    );
  },
  args: {
    prompt: '성능 테스트 - 빠르게 타이핑해보세요'
  }
};

// 반응형 테스트
export const ResponsiveTest: Story = {
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1200px', height: '800px' } }
      }
    }
  },
  args: {
    prompt: '반응형 테스트 - 화면 크기를 변경해보세요'
  }
};