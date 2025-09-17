/**
 * EmotionVisualizer Component
 *
 * 실시간 감정 벡터를 시각화하는 컴포넌트
 * 에너지, 긴장도, 집중도, 극성을 다양한 차트와 애니메이션으로 표현
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { EmotionProfile, EmotionVector } from '../../../shared/types/api';
import type { TypingStatistics } from '../../../shared/types/websocket';

interface EmotionVisualizerProps {
  /** 현재 감정 프로필 */
  emotionProfile: EmotionProfile | null;

  /** 실시간 타이핑 통계 */
  typingStats?: TypingStatistics;

  /** 시각화 모드 */
  mode?: 'compact' | 'detailed' | 'minimal';

  /** 애니메이션 활성화 여부 */
  animated?: boolean;

  /** 색상 테마 */
  theme?: 'default' | 'dark' | 'vibrant';

  /** CSS 클래스명 */
  className?: string;
}

interface WaveformPoint {
  x: number;
  y: number;
  intensity: number;
  timestamp: number;
}

const EmotionVisualizer: React.FC<EmotionVisualizerProps> = ({
  emotionProfile,
  typingStats,
  mode = 'detailed',
  animated = true,
  theme = 'default',
  className = ''
}) => {
  // State
  const [waveformData, setWaveformData] = useState<WaveformPoint[]>([]);
  const [animationFrame, setAnimationFrame] = useState(0);

  // Refs
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const radarCanvasRef = useRef<HTMLCanvasElement>(null);

  // 감정 벡터 기본값
  const emotion = emotionProfile?.emotion_vector || {
    energy: 0,
    valence: 0,
    tension: 0,
    focus: 0
  };

  // 색상 매핑
  const getEmotionColors = useCallback(() => {
    const baseColors = {
      energy: emotion.energy > 0.7 ? '#ef4444' : emotion.energy > 0.4 ? '#f59e0b' : '#6b7280',
      valence: emotion.valence > 0 ? '#10b981' : emotion.valence < -0.3 ? '#8b5cf6' : '#6b7280',
      tension: emotion.tension > 0.6 ? '#f87171' : emotion.tension > 0.3 ? '#fbbf24' : '#34d399',
      focus: emotion.focus > 0.7 ? '#1d4ed8' : emotion.focus > 0.4 ? '#3b82f6' : '#9ca3af'
    };

    if (theme === 'dark') {
      return {
        ...baseColors,
        background: '#1f2937',
        text: '#f9fafb',
        grid: '#374151'
      };
    }

    if (theme === 'vibrant') {
      return {
        energy: '#ff6b6b',
        valence: '#4ecdc4',
        tension: '#ffe66d',
        focus: '#a8e6cf',
        background: '#2d3436',
        text: '#ddd',
        grid: '#636e72'
      };
    }

    return {
      ...baseColors,
      background: '#ffffff',
      text: '#1f2937',
      grid: '#e5e7eb'
    };
  }, [emotion, theme]);

  const colors = getEmotionColors();

  // 웨이브폼 데이터 업데이트
  const updateWaveform = useCallback(() => {
    if (!typingStats) return;

    const now = Date.now();
    const intensity = (emotion.energy * 0.4 + emotion.tension * 0.3 + emotion.focus * 0.3);

    setWaveformData(prev => {
      const newData = [...prev, {
        x: now,
        y: Math.sin(now * 0.001) * intensity * 50 + Math.random() * 10,
        intensity,
        timestamp: now
      }];

      // 최근 200개 포인트만 유지
      return newData.slice(-200);
    });
  }, [emotion, typingStats]);

  // 웨이브폼 캔버스 그리기
  const drawWaveform = useCallback(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // 배경 그라데이션
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colors.background);
    gradient.addColorStop(1, `${colors.energy}20`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // 웨이브폼 그리기
    if (waveformData.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = colors.energy;
      ctx.lineWidth = 2;

      const startTime = waveformData[0].timestamp;
      const endTime = waveformData[waveformData.length - 1].timestamp;
      const timeRange = Math.max(endTime - startTime, 1);

      waveformData.forEach((point, index) => {
        const x = ((point.timestamp - startTime) / timeRange) * width;
        const y = height / 2 + point.y;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();
    }

    // 현재 강도 표시
    const currentIntensity = waveformData[waveformData.length - 1]?.intensity || 0;
    const pulseRadius = 20 + currentIntensity * 30;

    ctx.beginPath();
    ctx.arc(width - 30, height / 2, pulseRadius, 0, Math.PI * 2);
    ctx.fillStyle = `${colors.energy}${Math.floor(currentIntensity * 0.3 * 255).toString(16).padStart(2, '0')}`;
    ctx.fill();
  }, [waveformData, colors]);

  // 레이더 차트 그리기
  const drawRadarChart = useCallback(() => {
    const canvas = radarCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 20;

    ctx.clearRect(0, 0, width, height);

    // 배경 원 그리기
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, (radius / 5) * i, 0, Math.PI * 2);
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 축 그리기
    const axes = [
      { label: 'Energy', angle: 0, value: emotion.energy },
      { label: 'Valence', angle: Math.PI / 2, value: (emotion.valence + 1) / 2 }, // -1~1을 0~1로 변환
      { label: 'Tension', angle: Math.PI, value: emotion.tension },
      { label: 'Focus', angle: (3 * Math.PI) / 2, value: emotion.focus }
    ];

    axes.forEach(axis => {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(axis.angle) * radius,
        centerY + Math.sin(axis.angle) * radius
      );
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 라벨 그리기
      const labelX = centerX + Math.cos(axis.angle) * (radius + 15);
      const labelY = centerY + Math.sin(axis.angle) * (radius + 15);

      ctx.fillStyle = colors.text;
      ctx.font = '12px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(axis.label, labelX, labelY);
    });

    // 감정 데이터 폴리곤 그리기
    ctx.beginPath();
    axes.forEach((axis, index) => {
      const value = Math.max(0, Math.min(1, axis.value)); // 0-1 범위로 클램프
      const x = centerX + Math.cos(axis.angle) * radius * value;
      const y = centerY + Math.sin(axis.angle) * radius * value;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.closePath();

    // 채우기
    const emotionGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    emotionGradient.addColorStop(0, `${colors.energy}60`);
    emotionGradient.addColorStop(0.5, `${colors.valence}40`);
    emotionGradient.addColorStop(1, `${colors.focus}20`);

    ctx.fillStyle = emotionGradient;
    ctx.fill();

    // 테두리
    ctx.strokeStyle = colors.energy;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 데이터 포인트 그리기
    axes.forEach(axis => {
      const value = Math.max(0, Math.min(1, axis.value));
      const x = centerX + Math.cos(axis.angle) * radius * value;
      const y = centerY + Math.sin(axis.angle) * radius * value;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = colors.energy;
      ctx.fill();
    });
  }, [emotion, colors]);

  // 애니메이션 루프
  useEffect(() => {
    if (!animated) return;

    const animate = () => {
      setAnimationFrame(prev => prev + 1);
      updateWaveform();
      requestAnimationFrame(animate);
    };

    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [animated, updateWaveform]);

  // 캔버스 그리기
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform, animationFrame]);

  useEffect(() => {
    drawRadarChart();
  }, [drawRadarChart, emotion]);

  // 감정 레벨 바 컴포넌트
  const EmotionBar: React.FC<{
    label: string;
    value: number;
    color: string;
    unit?: string;
  }> = ({ label, value, color, unit = '' }) => (
    <div className="emotion-bar mb-3">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium" style={{ color: colors.text }}>
          {label}
        </span>
        <span className="text-sm font-mono" style={{ color: colors.text }}>
          {Math.round(value * 100)}{unit}
        </span>
      </div>
      <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${Math.max(0, Math.min(100, value * 100))}%`,
            backgroundColor: color,
            boxShadow: animated ? `0 0 10px ${color}40` : undefined
          }}
        />
      </div>
    </div>
  );

  // 컴팩트 모드
  if (mode === 'compact') {
    return (
      <div className={`emotion-visualizer-compact p-4 rounded-lg ${className}`}
           style={{ backgroundColor: colors.background }}>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(emotion).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-xs font-medium mb-1" style={{ color: colors.text }}>
                {key === 'energy' ? '에너지' :
                 key === 'valence' ? '극성' :
                 key === 'tension' ? '긴장도' : '집중도'}
              </div>
              <div
                className="text-lg font-bold"
                style={{ color: colors[key as keyof typeof colors] || colors.text }}
              >
                {key === 'valence'
                  ? (value > 0 ? `+${Math.round(value * 100)}` : Math.round(value * 100))
                  : Math.round(value * 100)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 최소 모드
  if (mode === 'minimal') {
    return (
      <div className={`emotion-visualizer-minimal flex items-center gap-2 p-2 rounded ${className}`}>
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: colors.energy }}
          title={`에너지: ${Math.round(emotion.energy * 100)}%`}
        />
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: colors.valence }}
          title={`극성: ${Math.round(emotion.valence * 100)}`}
        />
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: colors.tension }}
          title={`긴장도: ${Math.round(emotion.tension * 100)}%`}
        />
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: colors.focus }}
          title={`집중도: ${Math.round(emotion.focus * 100)}%`}
        />
      </div>
    );
  }

  // 상세 모드 (기본)
  return (
    <div
      className={`emotion-visualizer p-6 rounded-lg shadow-lg ${className}`}
      style={{ backgroundColor: colors.background }}
    >
      <h3 className="text-xl font-semibold mb-6" style={{ color: colors.text }}>
        감정 상태 분석
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 감정 바 차트 */}
        <div className="emotion-bars">
          <h4 className="text-lg font-medium mb-4" style={{ color: colors.text }}>
            감정 벡터
          </h4>

          <EmotionBar
            label="에너지 레벨"
            value={emotion.energy}
            color={colors.energy}
            unit="%"
          />

          <EmotionBar
            label="감정 극성"
            value={(emotion.valence + 1) / 2} // -1~1을 0~1로 변환
            color={colors.valence}
          />

          <EmotionBar
            label="긴장도"
            value={emotion.tension}
            color={colors.tension}
            unit="%"
          />

          <EmotionBar
            label="집중도"
            value={emotion.focus}
            color={colors.focus}
            unit="%"
          />

          {emotionProfile && (
            <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
              <div className="text-sm text-neutral-600">
                <div>신뢰도: {Math.round(emotionProfile.confidence_score * 100)}%</div>
                <div>템포: {Math.round(emotionProfile.tempo_score * 100)}</div>
                <div>리듬 일관성: {Math.round(emotionProfile.rhythm_consistency * 100)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* 레이더 차트 */}
        <div className="radar-chart">
          <h4 className="text-lg font-medium mb-4" style={{ color: colors.text }}>
            감정 패턴
          </h4>
          <canvas
            ref={radarCanvasRef}
            width={300}
            height={300}
            className="w-full max-w-sm mx-auto"
          />
        </div>
      </div>

      {/* 타이핑 리듬 파형 */}
      {typingStats && (
        <div className="waveform-section mt-6">
          <h4 className="text-lg font-medium mb-4" style={{ color: colors.text }}>
            타이핑 리듬 파형
          </h4>
          <div className="relative bg-neutral-50 rounded-lg overflow-hidden">
            <canvas
              ref={waveformCanvasRef}
              width={600}
              height={120}
              className="w-full h-30"
            />

            {/* 현재 상태 표시 */}
            <div className="absolute top-2 right-2 text-xs text-neutral-600 bg-white px-2 py-1 rounded">
              {typingStats.average_wpm} WPM
            </div>
          </div>
        </div>
      )}

      {/* 감정 상태 설명 */}
      {emotionProfile && (
        <div className="emotion-description mt-6 p-4 bg-neutral-50 rounded-lg">
          <h4 className="text-lg font-medium mb-2" style={{ color: colors.text }}>
            현재 감정 상태
          </h4>
          <p className="text-sm text-neutral-600">
            {emotion.energy > 0.7 ? '높은 에너지와' : emotion.energy > 0.4 ? '보통의 에너지와' : '낮은 에너지와'} {' '}
            {emotion.valence > 0.3 ? '긍정적인' : emotion.valence > -0.3 ? '중성적인' : '부정적인'} 감정을 {' '}
            {emotion.tension > 0.6 ? '긴장된' : '편안한'} 상태에서 {' '}
            {emotion.focus > 0.7 ? '높은 집중도로' : '보통 집중도로'} 표현하고 있습니다.
          </p>
        </div>
      )}
    </div>
  );
};

export default EmotionVisualizer;