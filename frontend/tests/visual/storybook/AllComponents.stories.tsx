/**
 * All Components Storybook Stories
 *
 * 모든 주요 UI 컴포넌트들의 시각적 테스트 및 Storybook 스토리
 */

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

// Mock 컴포넌트들 (실제 구현 대신 시각적 테스트용)
const MusicPlayer = ({ music, autoPlay, enableVolumeControl, showDownload, className }: any) => (
  <div className={`music-player bg-white rounded-lg shadow-md p-6 ${className || ''}`}>
    <div className="music-info mb-4">
      {music ? (
        <div>
          <h3 className="text-lg font-semibold text-neutral-800 mb-1">
            생성된 음악 #{music.id?.slice(-8) || 'unknown'}
          </h3>
          <div className="flex items-center gap-4 text-sm text-neutral-600">
            <span>형식: {music.format?.toUpperCase() || 'WAV'}</span>
            <span>길이: 3:00</span>
            <span>품질: 92%</span>
          </div>
        </div>
      ) : (
        <div className="text-neutral-500">재생할 음악이 없습니다</div>
      )}
    </div>

    <div className="music-controls mb-4 flex items-center gap-4">
      <button className="play-button w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white">
        ▶
      </button>
      <button className="stop-button w-10 h-10 bg-neutral-300 rounded-full flex items-center justify-center">
        ⏹
      </button>
      <div className="time-display text-sm text-neutral-600 font-mono">
        0:00 / 3:00
      </div>
      {showDownload && (
        <button className="ml-auto btn btn-ghost btn-sm">
          💾 다운로드
        </button>
      )}
    </div>

    <div className="progress-bar bg-neutral-200 rounded-full h-2 mb-4">
      <div className="bg-primary-500 h-full rounded-full w-1/3"></div>
    </div>

    {enableVolumeControl && (
      <div className="volume-controls flex items-center gap-3">
        <button>🔊</button>
        <div className="volume-bar bg-neutral-200 rounded-full h-2 w-24">
          <div className="bg-primary-500 h-full rounded-full w-4/5"></div>
        </div>
        <span className="text-xs">80</span>
      </div>
    )}
  </div>
);

const EmotionVisualizer = ({ emotionProfile, mode, theme, animated, className }: any) => {
  const emotions = emotionProfile?.emotion_vector || { energy: 0.5, valence: 0.2, tension: 0.3, focus: 0.7 };

  if (mode === 'minimal') {
    return (
      <div className={`emotion-visualizer-minimal flex items-center gap-2 p-2 rounded ${className || ''}`}>
        <div className="w-4 h-4 rounded-full bg-red-400" title="에너지: 50%"></div>
        <div className="w-4 h-4 rounded-full bg-green-400" title="극성: 20%"></div>
        <div className="w-4 h-4 rounded-full bg-yellow-400" title="긴장도: 30%"></div>
        <div className="w-4 h-4 rounded-full bg-blue-400" title="집중도: 70%"></div>
      </div>
    );
  }

  if (mode === 'compact') {
    return (
      <div className={`emotion-visualizer-compact p-4 rounded-lg bg-white ${className || ''}`}>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div><div className="text-xs font-medium mb-1">에너지</div><div className="text-lg font-bold">50</div></div>
          <div><div className="text-xs font-medium mb-1">극성</div><div className="text-lg font-bold">20</div></div>
          <div><div className="text-xs font-medium mb-1">긴장도</div><div className="text-lg font-bold">30</div></div>
          <div><div className="text-xs font-medium mb-1">집중도</div><div className="text-lg font-bold">70</div></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`emotion-visualizer p-6 rounded-lg shadow-lg bg-white ${className || ''}`}>
      <h3 className="text-xl font-semibold mb-6">감정 상태 분석</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="emotion-bars">
          <h4 className="text-lg font-medium mb-4">감정 벡터</h4>
          {Object.entries(emotions).map(([key, value]) => (
            <div key={key} className="emotion-bar mb-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{key}</span>
                <span className="text-sm font-mono">{Math.round(value * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-neutral-200 rounded-full">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${value * 100}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>

        <div className="radar-chart">
          <h4 className="text-lg font-medium mb-4">감정 패턴</h4>
          <div className="w-64 h-64 bg-gradient-to-br from-blue-50 to-purple-50 rounded-full mx-auto flex items-center justify-center">
            <div className="w-32 h-32 bg-primary-200 rounded-full opacity-60"></div>
          </div>
        </div>
      </div>

      <div className="emotion-description mt-6 p-4 bg-neutral-50 rounded-lg">
        <h4 className="text-lg font-medium mb-2">현재 감정 상태</h4>
        <p className="text-sm text-neutral-600">
          보통의 에너지와 긍정적인 감정을 편안한 상태에서 높은 집중도로 표현하고 있습니다.
        </p>
      </div>
    </div>
  );
};

const SessionStatus = ({ session, connectionState, musicCount, compact, className }: any) => (
  <div className={`session-status ${compact ? 'p-4' : 'p-6'} bg-white rounded-lg shadow ${className || ''}`}>
    <h3 className="text-lg font-semibold mb-4">세션 상태</h3>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>상태:</span>
        <span className={session?.is_active ? 'text-green-600' : 'text-gray-600'}>
          {session?.is_active ? '활성' : '비활성'}
        </span>
      </div>
      <div className="flex justify-between">
        <span>연결:</span>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            connectionState === 'connected' ? 'bg-green-500' : 'bg-gray-400'
          }`}></div>
          <span>{connectionState}</span>
        </div>
      </div>
      <div className="flex justify-between">
        <span>생성된 음악:</span>
        <span>{musicCount}개</span>
      </div>
      <div className="flex justify-between">
        <span>남은 시간:</span>
        <span>45분</span>
      </div>
    </div>
    <div className="mt-4 flex gap-2">
      <button className="btn btn-sm btn-outline">세션 연장</button>
      <button className="btn btn-sm btn-error">세션 종료</button>
    </div>
  </div>
);

const LoadingSpinner = ({ size, message, overlay, className }: any) => (
  <div className={`loading-spinner ${size || 'medium'} ${overlay ? 'overlay' : ''} ${className || ''}`}>
    <div className="spinner" role="status" aria-label="로딩 중">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
    </div>
    {message && <div className="loading-message mt-2 text-sm text-gray-600">{message}</div>}
  </div>
);

// 메타데이터
const meta: Meta = {
  title: 'Visual Tests/All Components',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: '모든 주요 컴포넌트들의 시각적 테스트 모음'
      }
    }
  }
};

export default meta;

// MusicPlayer Stories
export const MusicPlayerDefault: StoryObj = {
  render: () => (
    <div className="p-6">
      <MusicPlayer
        music={{
          id: 'music-123',
          format: 'wav',
          quality_score: 0.92
        }}
        enableVolumeControl={true}
        showDownload={true}
      />
    </div>
  ),
  name: 'MusicPlayer - Default'
};

export const MusicPlayerNoMusic: StoryObj = {
  render: () => (
    <div className="p-6">
      <MusicPlayer music={null} />
    </div>
  ),
  name: 'MusicPlayer - No Music'
};

export const MusicPlayerCompact: StoryObj = {
  render: () => (
    <div className="p-6">
      <MusicPlayer
        music={{
          id: 'music-456',
          format: 'mp3'
        }}
        enableVolumeControl={false}
        showDownload={false}
        className="max-w-md"
      />
    </div>
  ),
  name: 'MusicPlayer - Compact'
};

// EmotionVisualizer Stories
export const EmotionVisualizerDetailed: StoryObj = {
  render: () => (
    <div className="p-6">
      <EmotionVisualizer
        emotionProfile={{
          emotion_vector: {
            energy: 0.8,
            valence: 0.6,
            tension: 0.4,
            focus: 0.7
          }
        }}
        mode="detailed"
        animated={true}
      />
    </div>
  ),
  name: 'EmotionVisualizer - Detailed'
};

export const EmotionVisualizerCompact: StoryObj = {
  render: () => (
    <div className="p-6">
      <EmotionVisualizer
        emotionProfile={{
          emotion_vector: {
            energy: 0.3,
            valence: -0.2,
            tension: 0.6,
            focus: 0.4
          }
        }}
        mode="compact"
      />
    </div>
  ),
  name: 'EmotionVisualizer - Compact'
};

export const EmotionVisualizerMinimal: StoryObj = {
  render: () => (
    <div className="p-6">
      <EmotionVisualizer
        emotionProfile={{
          emotion_vector: {
            energy: 0.5,
            valence: 0.2,
            tension: 0.3,
            focus: 0.9
          }
        }}
        mode="minimal"
      />
    </div>
  ),
  name: 'EmotionVisualizer - Minimal'
};

// SessionStatus Stories
export const SessionStatusActive: StoryObj = {
  render: () => (
    <div className="p-6">
      <SessionStatus
        session={{
          id: 'session-123',
          is_active: true
        }}
        connectionState="connected"
        musicCount={3}
      />
    </div>
  ),
  name: 'SessionStatus - Active'
};

export const SessionStatusDisconnected: StoryObj = {
  render: () => (
    <div className="p-6">
      <SessionStatus
        session={{
          id: 'session-456',
          is_active: false
        }}
        connectionState="disconnected"
        musicCount={0}
      />
    </div>
  ),
  name: 'SessionStatus - Disconnected'
};

// LoadingSpinner Stories
export const LoadingSpinnerDefault: StoryObj = {
  render: () => (
    <div className="p-6">
      <LoadingSpinner />
    </div>
  ),
  name: 'LoadingSpinner - Default'
};

export const LoadingSpinnerWithMessage: StoryObj = {
  render: () => (
    <div className="p-6">
      <LoadingSpinner
        size="large"
        message="음악을 생성하는 중..."
      />
    </div>
  ),
  name: 'LoadingSpinner - With Message'
};

export const LoadingSpinnerOverlay: StoryObj = {
  render: () => (
    <div className="relative p-6 h-64">
      <div className="h-full bg-gray-100 rounded-lg p-4">
        <p>배경 콘텐츠</p>
      </div>
      <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <LoadingSpinner
          size="large"
          message="처리 중..."
          overlay={true}
          className="text-white"
        />
      </div>
    </div>
  ),
  name: 'LoadingSpinner - Overlay'
};

// 종합 레이아웃 테스트
export const FullLayoutTest: StoryObj = {
  render: () => (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-4">
        <h1 className="text-2xl font-bold text-gray-900">VibeMusic</h1>
      </header>

      <main className="container mx-auto p-6 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EmotionVisualizer
              emotionProfile={{
                emotion_vector: {
                  energy: 0.7,
                  valence: 0.4,
                  tension: 0.3,
                  focus: 0.8
                }
              }}
              mode="detailed"
            />
          </div>

          <div>
            <SessionStatus
              session={{
                id: 'session-789',
                is_active: true
              }}
              connectionState="connected"
              musicCount={2}
            />
          </div>
        </div>

        <MusicPlayer
          music={{
            id: 'music-current',
            format: 'wav',
            quality_score: 0.88
          }}
          enableVolumeControl={true}
          showDownload={true}
        />
      </main>
    </div>
  ),
  name: 'Full Layout Test'
};

// 다크 테마 테스트
export const DarkThemeTest: StoryObj = {
  decorators: [
    (Story) => (
      <div className="dark bg-gray-900 min-h-screen">
        <Story />
      </div>
    )
  ],
  render: () => (
    <div className="p-6 space-y-6">
      <EmotionVisualizer
        emotionProfile={{
          emotion_vector: {
            energy: 0.6,
            valence: -0.1,
            tension: 0.5,
            focus: 0.7
          }
        }}
        mode="detailed"
        theme="dark"
        className="bg-gray-800 text-white"
      />

      <MusicPlayer
        music={{
          id: 'music-dark',
          format: 'mp3'
        }}
        className="bg-gray-800 text-white"
      />
    </div>
  ),
  name: 'Dark Theme Test'
};

// 반응형 테스트
export const ResponsiveTest: StoryObj = {
  parameters: {
    viewport: {
      viewports: {
        mobile: { name: 'Mobile', styles: { width: '375px', height: '667px' } },
        tablet: { name: 'Tablet', styles: { width: '768px', height: '1024px' } },
        desktop: { name: 'Desktop', styles: { width: '1200px', height: '800px' } }
      }
    }
  },
  render: () => (
    <div className="p-4 space-y-4">
      <EmotionVisualizer
        emotionProfile={{
          emotion_vector: {
            energy: 0.5,
            valence: 0.3,
            tension: 0.2,
            focus: 0.6
          }
        }}
        mode="compact"
        className="w-full"
      />

      <MusicPlayer
        music={{
          id: 'responsive-test',
          format: 'wav'
        }}
        className="w-full"
      />

      <SessionStatus
        session={{
          id: 'responsive-session',
          is_active: true
        }}
        connectionState="connected"
        musicCount={1}
        compact={true}
        className="w-full"
      />
    </div>
  ),
  name: 'Responsive Test'
};

// 접근성 테스트
export const AccessibilityTest: StoryObj = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: 'color-contrast', enabled: true },
          { id: 'keyboard-navigation', enabled: true },
          { id: 'aria-labels', enabled: true }
        ]
      }
    }
  },
  render: () => (
    <div className="p-6 space-y-6">
      <EmotionVisualizer
        emotionProfile={{
          emotion_vector: {
            energy: 0.8,
            valence: 0.2,
            tension: 0.6,
            focus: 0.4
          }
        }}
        mode="detailed"
      />

      <MusicPlayer
        music={{
          id: 'a11y-test',
          format: 'wav'
        }}
      />

      <LoadingSpinner message="접근성 테스트 로딩..." />
    </div>
  ),
  name: 'Accessibility Test'
};