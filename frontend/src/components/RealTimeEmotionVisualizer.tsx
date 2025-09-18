/**
 * T008: 프론트엔드 감정 시각화 연동 - 실시간 감정 시각화 컴포넌트
 * WebSocket으로 받은 감정 데이터를 실시간으로 시각화하는 통합 컴포넌트
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useEmotionData, EmotionData, EmotionTrend } from '../hooks/useEmotionData';
import { useWebSocket } from '../hooks/useWebSocket';

interface RealTimeEmotionVisualizerProps {
  sessionId: string;
  className?: string;
  style?: React.CSSProperties;
  mode?: 'compact' | 'detailed' | 'minimal';
  animated?: boolean;
  theme?: 'default' | 'dark' | 'vibrant';
  onEmotionUpdate?: (emotion: EmotionData) => void;
}

interface AnimatedLineChart {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  data: { time: number; value: number }[];
  color: string;
  label: string;
  range: [number, number];
}

const RealTimeEmotionVisualizer: React.FC<RealTimeEmotionVisualizerProps> = ({
  sessionId,
  className = '',
  style,
  mode = 'detailed',
  animated = true,
  theme = 'default',
  onEmotionUpdate
}) => {
  // 상태 관리
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<keyof EmotionData>('energy');

  // 캔버스 레퍼런스
  const energyCanvasRef = useRef<HTMLCanvasElement>(null);
  const valenceCanvasRef = useRef<HTMLCanvasElement>(null);
  const tensionCanvasRef = useRef<HTMLCanvasElement>(null);
  const focusCanvasRef = useRef<HTMLCanvasElement>(null);
  const combinedCanvasRef = useRef<HTMLCanvasElement>(null);

  // 감정 데이터 훅
  const {
    currentEmotion,
    smoothedEmotion,
    emotionHistory,
    emotionTrends,
    emotionSummary,
    handleWebSocketMessage,
    isReceivingData,
    lastUpdateTime,
    dataQuality
  } = useEmotionData({
    sessionId,
    maxHistorySize: 200,
    smoothingWindow: 5,
    trendAnalysisWindow: 30000,
    onEmotionUpdate,
    onTrendChange: (trends) => {
      console.log('💭 감정 트렌드 업데이트:', trends);
    }
  });

  // WebSocket 연결
  const { connectionState, isConnected } = useWebSocket({
    sessionId,
    onMessage: handleWebSocketMessage,
    autoConnect: true
  });

  // 색상 테마
  const getThemeColors = useCallback(() => {
    const themes = {
      default: {
        energy: '#ef4444',
        valence: '#10b981',
        tension: '#f59e0b',
        focus: '#3b82f6',
        background: '#ffffff',
        text: '#1f2937',
        grid: '#e5e7eb',
        accent: '#6366f1'
      },
      dark: {
        energy: '#f87171',
        valence: '#34d399',
        tension: '#fbbf24',
        focus: '#60a5fa',
        background: '#1f2937',
        text: '#f9fafb',
        grid: '#374151',
        accent: '#818cf8'
      },
      vibrant: {
        energy: '#ff6b6b',
        valence: '#4ecdc4',
        tension: '#ffe66d',
        focus: '#a8e6cf',
        background: '#2d3436',
        text: '#ddd',
        grid: '#636e72',
        accent: '#fd79a8'
      }
    };
    return themes[theme];
  }, [theme]);

  const colors = getThemeColors();

  // 실시간 차트 그리기
  const drawLineChart = useCallback((
    canvas: HTMLCanvasElement,
    data: { time: number; value: number }[],
    color: string,
    range: [number, number] = [0, 1]
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx || data.length === 0) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // 배경 그라데이션
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, `${color}10`);
    bgGradient.addColorStop(1, `${color}02`);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // 그리드 라인
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // 데이터 라인
    if (data.length > 1) {
      const timeRange = data[data.length - 1].time - data[0].time;
      const valueRange = range[1] - range[0];

      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      data.forEach((point, index) => {
        const x = timeRange > 0 ? ((point.time - data[0].time) / timeRange) * width : 0;
        const y = height - ((point.value - range[0]) / valueRange) * height;

        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });

      ctx.stroke();

      // 선 아래 영역 채우기
      if (animated) {
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        const areaGradient = ctx.createLinearGradient(0, 0, 0, height);
        areaGradient.addColorStop(0, `${color}30`);
        areaGradient.addColorStop(1, `${color}05`);
        ctx.fillStyle = areaGradient;
        ctx.fill();
      }

      // 현재 값 포인트
      const lastPoint = data[data.length - 1];
      const lastX = timeRange > 0 ? ((lastPoint.time - data[0].time) / timeRange) * width : width;
      const lastY = height - ((lastPoint.value - range[0]) / valueRange) * height;

      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      if (animated) {
        ctx.beginPath();
        ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}60`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [colors, animated]);

  // 캔버스 업데이트
  useEffect(() => {
    if (emotionHistory.length === 0) return;

    const chartData = emotionHistory.map(item => ({
      time: item.timestamp.getTime(),
      energy: item.energy,
      valence: item.valence,
      tension: item.tension,
      focus: item.focus
    }));

    // 개별 차트 그리기
    if (energyCanvasRef.current) {
      drawLineChart(
        energyCanvasRef.current,
        chartData.map(d => ({ time: d.time, value: d.energy })),
        colors.energy
      );
    }

    if (valenceCanvasRef.current) {
      drawLineChart(
        valenceCanvasRef.current,
        chartData.map(d => ({ time: d.time, value: d.valence })),
        colors.valence,
        [-1, 1]
      );
    }

    if (tensionCanvasRef.current) {
      drawLineChart(
        tensionCanvasRef.current,
        chartData.map(d => ({ time: d.time, value: d.tension })),
        colors.tension
      );
    }

    if (focusCanvasRef.current) {
      drawLineChart(
        focusCanvasRef.current,
        chartData.map(d => ({ time: d.time, value: d.focus })),
        colors.focus
      );
    }

    // 통합 차트 그리기
    if (combinedCanvasRef.current) {
      const canvas = combinedCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        drawLineChart(canvas, chartData.map(d => ({ time: d.time, value: d.energy })), colors.energy);
        drawLineChart(canvas, chartData.map(d => ({ time: d.time, value: (d.valence + 1) / 2 })), colors.valence);
        drawLineChart(canvas, chartData.map(d => ({ time: d.time, value: d.tension })), colors.tension);
        drawLineChart(canvas, chartData.map(d => ({ time: d.time, value: d.focus })), colors.focus);
      }
    }
  }, [emotionHistory, colors, drawLineChart]);

  // 트렌드 표시 컴포넌트
  const TrendIndicator: React.FC<{ trend: EmotionTrend }> = ({ trend }) => (
    <div className="flex items-center gap-2 text-sm">
      <span className="capitalize text-gray-600">{trend.metric}:</span>
      <span className={`flex items-center gap-1 ${
        trend.direction === 'increasing' ? 'text-green-600' :
        trend.direction === 'decreasing' ? 'text-red-600' : 'text-gray-500'
      }`}>
        {trend.direction === 'increasing' ? '↗' :
         trend.direction === 'decreasing' ? '↘' : '→'}
        <span className="font-mono">
          {trend.direction !== 'stable' ? `${Math.abs(trend.change * 100).toFixed(1)}%` : 'stable'}
        </span>
      </span>
    </div>
  );

  // 메트릭 카드 컴포넌트
  const MetricCard: React.FC<{
    label: string;
    value: number;
    color: string;
    trend?: EmotionTrend;
    unit?: string;
    range?: [number, number];
  }> = ({ label, value, color, trend, unit = '%', range = [0, 1] }) => {
    const normalizedValue = range[1] === 1 && range[0] === 0
      ? value
      : (value - range[0]) / (range[1] - range[0]);

    const displayValue = range[1] === 1 && range[0] === 0
      ? Math.round(value * 100)
      : Math.round(value * 100);

    return (
      <div className="metric-card p-4 rounded-lg border" style={{ backgroundColor: colors.background }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium" style={{ color: colors.text }}>{label}</span>
          <span className="text-lg font-bold" style={{ color }}>
            {range[0] === -1 ? (value >= 0 ? '+' : '') : ''}{displayValue}{unit}
          </span>
        </div>

        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{
              width: `${Math.max(0, Math.min(100, normalizedValue * 100))}%`,
              backgroundColor: color,
              boxShadow: animated ? `0 0 8px ${color}40` : undefined
            }}
          />
        </div>

        {trend && (
          <div className="mt-2">
            <TrendIndicator trend={trend} />
          </div>
        )}
      </div>
    );
  };

  // 연결 상태 표시
  const ConnectionStatus: React.FC = () => (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-2 h-2 rounded-full ${
        isConnected ? 'bg-green-500' : 'bg-red-500'
      } ${animated && isConnected ? 'animate-pulse' : ''}`} />
      <span style={{ color: colors.text }}>
        {isConnected ? '연결됨' : '연결 중...'}
      </span>
      {isReceivingData && (
        <span className="text-xs text-green-600 font-medium">
          데이터 수신 중
        </span>
      )}
      <span className={`text-xs px-2 py-1 rounded ${
        dataQuality === 'excellent' ? 'bg-green-100 text-green-800' :
        dataQuality === 'good' ? 'bg-blue-100 text-blue-800' :
        dataQuality === 'fair' ? 'bg-yellow-100 text-yellow-800' :
        dataQuality === 'poor' ? 'bg-orange-100 text-orange-800' : 'bg-red-100 text-red-800'
      }`}>
        {dataQuality === 'excellent' ? '우수' :
         dataQuality === 'good' ? '양호' :
         dataQuality === 'fair' ? '보통' :
         dataQuality === 'poor' ? '불량' : '데이터 없음'}
      </span>
    </div>
  );

  // 모드별 렌더링
  if (mode === 'minimal') {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg ${className}`}
           style={{ backgroundColor: colors.background, ...(style || {}) }}>
        <ConnectionStatus />
        {currentEmotion && (
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full"
                 style={{ backgroundColor: colors.energy }}
                 title={`에너지: ${Math.round(currentEmotion.energy * 100)}%`} />
            <div className="w-3 h-3 rounded-full"
                 style={{ backgroundColor: colors.valence }}
                 title={`감정가: ${Math.round(currentEmotion.valence * 100)}`} />
            <div className="w-3 h-3 rounded-full"
                 style={{ backgroundColor: colors.tension }}
                 title={`긴장도: ${Math.round(currentEmotion.tension * 100)}%`} />
            <div className="w-3 h-3 rounded-full"
                 style={{ backgroundColor: colors.focus }}
                 title={`집중도: ${Math.round(currentEmotion.focus * 100)}%`} />
          </div>
        )}
      </div>
    );
  }

  if (mode === 'compact') {
    return (
      <div className={`p-4 rounded-lg ${className}`} style={{ backgroundColor: colors.background, ...(style || {}) }}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold" style={{ color: colors.text }}>실시간 감정</h3>
          <ConnectionStatus />
        </div>

        {currentEmotion ? (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="에너지"
              value={currentEmotion.energy}
              color={colors.energy}
              trend={emotionTrends.find(t => t.metric === 'energy')}
            />
            <MetricCard
              label="감정가"
              value={currentEmotion.valence}
              color={colors.valence}
              trend={emotionTrends.find(t => t.metric === 'valence')}
              range={[-1, 1]}
            />
            <MetricCard
              label="긴장도"
              value={currentEmotion.tension}
              color={colors.tension}
              trend={emotionTrends.find(t => t.metric === 'tension')}
            />
            <MetricCard
              label="집중도"
              value={currentEmotion.focus}
              color={colors.focus}
              trend={emotionTrends.find(t => t.metric === 'focus')}
            />
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: colors.text }}>
            감정 데이터를 기다리는 중...
          </div>
        )}
      </div>
    );
  }

  // 상세 모드 (기본)
  return (
    <div
      data-testid="realtime-emotion-visualizer"
      className={`p-6 rounded-lg shadow-lg ${className}`}
      style={{ backgroundColor: colors.background, ...(style || {}) }}>

      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: colors.text }}>
          실시간 감정 분석
        </h2>
        <div className="flex items-center gap-4">
          <ConnectionStatus />
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-3 py-1 rounded text-sm border"
            style={{
              color: colors.text,
              borderColor: colors.grid,
              backgroundColor: isExpanded ? colors.accent : 'transparent'
            }}
          >
            {isExpanded ? '간단히' : '상세히'}
          </button>
        </div>
      </div>

      {/* 현재 감정 상태 */}
      {currentEmotion && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <MetricCard
            label="에너지 레벨"
            value={currentEmotion.energy}
            color={colors.energy}
            trend={emotionTrends.find(t => t.metric === 'energy')}
          />
          <MetricCard
            label="감정 극성"
            value={currentEmotion.valence}
            color={colors.valence}
            trend={emotionTrends.find(t => t.metric === 'valence')}
            range={[-1, 1]}
          />
          <MetricCard
            label="긴장도"
            value={currentEmotion.tension}
            color={colors.tension}
            trend={emotionTrends.find(t => t.metric === 'tension')}
          />
          <MetricCard
            label="집중도"
            value={currentEmotion.focus}
            color={colors.focus}
            trend={emotionTrends.find(t => t.metric === 'focus')}
          />
        </div>
      )}

      {/* 실시간 차트 */}
      {emotionHistory.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold" style={{ color: colors.text }}>
            감정 변화 추이
          </h3>

          {isExpanded ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 개별 차트들 */}
              <div>
                <h4 className="text-sm font-medium mb-2" style={{ color: colors.energy }}>에너지</h4>
                <canvas ref={energyCanvasRef} width={300} height={120} className="w-full border rounded" />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2" style={{ color: colors.valence }}>감정가</h4>
                <canvas ref={valenceCanvasRef} width={300} height={120} className="w-full border rounded" />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2" style={{ color: colors.tension }}>긴장도</h4>
                <canvas ref={tensionCanvasRef} width={300} height={120} className="w-full border rounded" />
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2" style={{ color: colors.focus }}>집중도</h4>
                <canvas ref={focusCanvasRef} width={300} height={120} className="w-full border rounded" />
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-medium mb-2" style={{ color: colors.text }}>통합 차트</h4>
              <canvas ref={combinedCanvasRef} width={600} height={200} className="w-full border rounded" />
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.energy }}></div>
                  <span className="text-xs" style={{ color: colors.text }}>에너지</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.valence }}></div>
                  <span className="text-xs" style={{ color: colors.text }}>감정가</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.tension }}></div>
                  <span className="text-xs" style={{ color: colors.text }}>긴장도</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.focus }}></div>
                  <span className="text-xs" style={{ color: colors.text }}>집중도</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 감정 요약 */}
      {emotionSummary && (
        <div className="mt-6 p-4 rounded-lg border" style={{ backgroundColor: `${colors.background}f0` }}>
          <h3 className="text-lg font-semibold mb-3" style={{ color: colors.text }}>감정 분석 요약</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm" style={{ color: colors.text }}>
                <strong>지배적 감정:</strong> {
                  emotionSummary.dominantEmotion === 'positive' ? '긍정적' :
                  emotionSummary.dominantEmotion === 'negative' ? '부정적' :
                  emotionSummary.dominantEmotion === 'energetic' ? '활기찬' :
                  emotionSummary.dominantEmotion === 'calm' ? '차분한' : '중성적'
                }
              </p>
              <p className="text-sm mt-1" style={{ color: colors.text }}>
                <strong>감정 안정성:</strong> {Math.round(emotionSummary.emotionStability * 100)}%
              </p>
              <p className="text-sm mt-1" style={{ color: colors.text }}>
                <strong>분석 데이터:</strong> {emotionSummary.dataCount}개
              </p>
            </div>
            <div className="text-sm" style={{ color: colors.text }}>
              <p><strong>평균 에너지:</strong> {Math.round(emotionSummary.averageEnergy * 100)}%</p>
              <p><strong>평균 감정가:</strong> {Math.round(emotionSummary.averageValence * 100)}</p>
              <p><strong>평균 긴장도:</strong> {Math.round(emotionSummary.averageTension * 100)}%</p>
              <p><strong>평균 집중도:</strong> {Math.round(emotionSummary.averageFocus * 100)}%</p>
            </div>
          </div>
        </div>
      )}

      {/* 마지막 업데이트 시간 */}
      {lastUpdateTime && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          마지막 업데이트: {lastUpdateTime.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
};

export default RealTimeEmotionVisualizer;