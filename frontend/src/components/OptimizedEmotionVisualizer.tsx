/**
 * OptimizedEmotionVisualizer Component
 *
 * 60fps 목표로 최적화된 실시간 감정 벡터 시각화 컴포넌트
 * - RAF 제어로 성능 최적화
 * - Canvas 렌더링 최적화
 * - 메모리 효율성 개선
 * - Throttling/Debouncing 적용
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  useImperativeHandle,
  forwardRef
} from 'react'
import type { EmotionProfile, EmotionVector } from '../../../shared/types/api'
import type { TypingStatistics } from '../../../shared/types/websocket'

interface EmotionVisualizerProps {
  emotionProfile: EmotionProfile | null
  typingStats?: TypingStatistics
  mode?: 'compact' | 'detailed' | 'minimal'
  animated?: boolean
  theme?: 'default' | 'dark' | 'vibrant'
  className?: string
  // 성능 옵션
  maxFPS?: number
  enablePerformanceMode?: boolean
  skipFrames?: number
}

interface WaveformPoint {
  x: number
  y: number
  intensity: number
  timestamp: number
}

interface PerformanceMetrics {
  fps: number
  frameTime: number
  skipCount: number
  renderCount: number
}

interface VisualizerHandle {
  getPerformanceMetrics: () => PerformanceMetrics
  pauseAnimation: () => void
  resumeAnimation: () => void
  clearCanvas: () => void
}

// 애니메이션 제어 클래스
class AnimationController {
  private animationId: number | null = null
  private lastFrameTime = 0
  private frameCount = 0
  private fpsHistory: number[] = []
  private skipCount = 0

  constructor(
    private targetFPS: number = 60,
    private enablePerformance: boolean = false,
    private skipFrames: number = 0
  ) {}

  start(callback: (deltaTime: number) => void) {
    const animate = (currentTime: number) => {
      const deltaTime = currentTime - this.lastFrameTime

      // FPS 제한
      const targetFrameTime = 1000 / this.targetFPS
      if (deltaTime < targetFrameTime) {
        this.animationId = requestAnimationFrame(animate)
        return
      }

      // 프레임 스킵 처리
      if (this.skipFrames > 0 && this.frameCount % (this.skipFrames + 1) !== 0) {
        this.skipCount++
        this.frameCount++
        this.animationId = requestAnimationFrame(animate)
        return
      }

      // 성능 모드에서 FPS 계산
      if (this.enablePerformance) {
        const fps = 1000 / deltaTime
        this.fpsHistory.push(fps)
        if (this.fpsHistory.length > 60) {
          this.fpsHistory.shift()
        }
      }

      callback(deltaTime)

      this.lastFrameTime = currentTime
      this.frameCount++
      this.animationId = requestAnimationFrame(animate)
    }

    this.animationId = requestAnimationFrame(animate)
  }

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  getMetrics(): PerformanceMetrics {
    const avgFPS = this.fpsHistory.length > 0
      ? this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length
      : 0

    return {
      fps: Math.round(avgFPS),
      frameTime: avgFPS > 0 ? 1000 / avgFPS : 0,
      skipCount: this.skipCount,
      renderCount: this.frameCount
    }
  }

  pause() {
    this.stop()
  }

  resume(callback: (deltaTime: number) => void) {
    this.start(callback)
  }
}

// 데이터 관리 클래스
class WaveformDataManager {
  private data: WaveformPoint[] = []
  private maxPoints: number

  constructor(maxPoints = 200) {
    this.maxPoints = maxPoints
  }

  addPoint(point: WaveformPoint) {
    this.data.push(point)
    if (this.data.length > this.maxPoints) {
      this.data = this.data.slice(-this.maxPoints)
    }
  }

  getData(): WaveformPoint[] {
    return this.data
  }

  clear() {
    this.data = []
  }

  getLatestPoint(): WaveformPoint | undefined {
    return this.data[this.data.length - 1]
  }

  // 성능을 위한 데이터 다운샘플링
  getDownsampledData(targetPoints: number): WaveformPoint[] {
    if (this.data.length <= targetPoints) {
      return this.data
    }

    const step = this.data.length / targetPoints
    const downsampled: WaveformPoint[] = []

    for (let i = 0; i < targetPoints; i++) {
      const index = Math.floor(i * step)
      downsampled.push(this.data[index])
    }

    return downsampled
  }
}

// Canvas 렌더러 클래스
class CanvasRenderer {
  private lastDrawTime = 0
  private drawThrottle = 16 // ~60fps

  constructor(private canvas: HTMLCanvasElement) {}

  shouldDraw(): boolean {
    const now = Date.now()
    if (now - this.lastDrawTime < this.drawThrottle) {
      return false
    }
    this.lastDrawTime = now
    return true
  }

  clear() {
    const ctx = this.canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  drawWaveform(data: WaveformPoint[], colors: any) {
    if (!this.shouldDraw() || data.length === 0) return

    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = this.canvas
    ctx.clearRect(0, 0, width, height)

    // 배경 그라데이션 (캐시된 그라데이션 사용)
    const gradient = this.getOrCreateGradient(ctx, colors, width, height)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    // 웨이브폼 그리기 (Path2D 사용으로 최적화)
    if (data.length > 1) {
      const path = new Path2D()
      const startTime = data[0].timestamp
      const endTime = data[data.length - 1].timestamp
      const timeRange = Math.max(endTime - startTime, 1)

      data.forEach((point, index) => {
        const x = ((point.timestamp - startTime) / timeRange) * width
        const y = height / 2 + point.y

        if (index === 0) {
          path.moveTo(x, y)
        } else {
          path.lineTo(x, y)
        }
      })

      ctx.strokeStyle = colors.energy
      ctx.lineWidth = 2
      ctx.stroke(path)
    }

    // 현재 강도 표시
    const currentPoint = data[data.length - 1]
    if (currentPoint) {
      const pulseRadius = 20 + currentPoint.intensity * 30
      ctx.beginPath()
      ctx.arc(width - 30, height / 2, pulseRadius, 0, Math.PI * 2)
      ctx.fillStyle = `${colors.energy}${Math.floor(currentPoint.intensity * 0.3 * 255).toString(16).padStart(2, '0')}`
      ctx.fill()
    }
  }

  private gradientCache = new Map<string, CanvasGradient>()

  private getOrCreateGradient(ctx: CanvasRenderingContext2D, colors: any, width: number, height: number): CanvasGradient {
    const key = `${colors.background}-${colors.energy}-${width}-${height}`

    if (!this.gradientCache.has(key)) {
      const gradient = ctx.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, colors.background)
      gradient.addColorStop(1, `${colors.energy}20`)
      this.gradientCache.set(key, gradient)
    }

    return this.gradientCache.get(key)!
  }

  drawRadarChart(emotion: EmotionVector, colors: any) {
    if (!this.shouldDraw()) return

    const ctx = this.canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = this.canvas
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20

    ctx.clearRect(0, 0, width, height)

    // 배경 원 그리기 (한 번에 그리기)
    ctx.strokeStyle = colors.grid
    ctx.lineWidth = 1
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath()
      ctx.arc(centerX, centerY, (radius / 5) * i, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 축 데이터
    const axes = [
      { label: 'Energy', angle: 0, value: emotion.energy },
      { label: 'Valence', angle: Math.PI / 2, value: (emotion.valence + 1) / 2 },
      { label: 'Tension', angle: Math.PI, value: emotion.tension },
      { label: 'Focus', angle: (3 * Math.PI) / 2, value: emotion.focus }
    ]

    // 축 그리기
    axes.forEach(axis => {
      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(
        centerX + Math.cos(axis.angle) * radius,
        centerY + Math.sin(axis.angle) * radius
      )
      ctx.stroke()

      // 라벨
      const labelX = centerX + Math.cos(axis.angle) * (radius + 15)
      const labelY = centerY + Math.sin(axis.angle) * (radius + 15)
      ctx.fillStyle = colors.text
      ctx.font = '12px Inter'
      ctx.textAlign = 'center'
      ctx.fillText(axis.label, labelX, labelY)
    })

    // 감정 데이터 폴리곤
    const path = new Path2D()
    axes.forEach((axis, index) => {
      const value = Math.max(0, Math.min(1, axis.value))
      const x = centerX + Math.cos(axis.angle) * radius * value
      const y = centerY + Math.sin(axis.angle) * radius * value

      if (index === 0) {
        path.moveTo(x, y)
      } else {
        path.lineTo(x, y)
      }
    })
    path.closePath()

    // 그라데이션 채우기
    const emotionGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
    emotionGradient.addColorStop(0, `${colors.energy}60`)
    emotionGradient.addColorStop(0.5, `${colors.valence}40`)
    emotionGradient.addColorStop(1, `${colors.focus}20`)

    ctx.fillStyle = emotionGradient
    ctx.fill(path)

    ctx.strokeStyle = colors.energy
    ctx.lineWidth = 2
    ctx.stroke(path)

    // 데이터 포인트
    axes.forEach(axis => {
      const value = Math.max(0, Math.min(1, axis.value))
      const x = centerX + Math.cos(axis.angle) * radius * value
      const y = centerY + Math.sin(axis.angle) * radius * value

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fillStyle = colors.energy
      ctx.fill()
    })
  }
}

// Throttle 유틸리티
function useThrottle<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef(0)

  return useCallback((...args: any[]) => {
    const now = Date.now()
    if (now - lastCall.current >= delay) {
      lastCall.current = now
      callback(...args)
    }
  }, [callback, delay]) as T
}

const OptimizedEmotionVisualizer = forwardRef<VisualizerHandle, EmotionVisualizerProps>(({
  emotionProfile,
  typingStats,
  mode = 'detailed',
  animated = true,
  theme = 'default',
  className = '',
  maxFPS = 60,
  enablePerformanceMode = false,
  skipFrames = 0
}, ref) => {
  // State
  const [isAnimating, setIsAnimating] = useState(animated)
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    frameTime: 0,
    skipCount: 0,
    renderCount: 0
  })

  // Refs
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null)
  const radarCanvasRef = useRef<HTMLCanvasElement>(null)
  const animationControllerRef = useRef<AnimationController>()
  const waveformDataManagerRef = useRef<WaveformDataManager>()
  const waveformRendererRef = useRef<CanvasRenderer>()
  const radarRendererRef = useRef<CanvasRenderer>()

  // 감정 벡터 기본값 (메모이제이션)
  const emotion = useMemo(() => emotionProfile?.emotion_vector || {
    energy: 0,
    valence: 0,
    tension: 0,
    focus: 0
  }, [emotionProfile?.emotion_vector])

  // 색상 매핑 (메모이제이션)
  const colors = useMemo(() => {
    const baseColors = {
      energy: emotion.energy > 0.7 ? '#ef4444' : emotion.energy > 0.4 ? '#f59e0b' : '#6b7280',
      valence: emotion.valence > 0 ? '#10b981' : emotion.valence < -0.3 ? '#8b5cf6' : '#6b7280',
      tension: emotion.tension > 0.6 ? '#f87171' : emotion.tension > 0.3 ? '#fbbf24' : '#34d399',
      focus: emotion.focus > 0.7 ? '#1d4ed8' : emotion.focus > 0.4 ? '#3b82f6' : '#9ca3af'
    }

    if (theme === 'dark') {
      return {
        ...baseColors,
        background: '#1f2937',
        text: '#f9fafb',
        grid: '#374151'
      }
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
      }
    }

    return {
      ...baseColors,
      background: '#ffffff',
      text: '#1f2937',
      grid: '#e5e7eb'
    }
  }, [emotion, theme])

  // 웨이브폼 데이터 업데이트 (throttled)
  const updateWaveform = useThrottle(useCallback(() => {
    if (!typingStats || !waveformDataManagerRef.current) return

    const now = Date.now()
    const intensity = (emotion.energy * 0.4 + emotion.tension * 0.3 + emotion.focus * 0.3)

    waveformDataManagerRef.current.addPoint({
      x: now,
      y: Math.sin(now * 0.001) * intensity * 50 + Math.random() * 10,
      intensity,
      timestamp: now
    })
  }, [emotion, typingStats]), 33) // ~30fps for data updates

  // 초기화
  useEffect(() => {
    if (waveformCanvasRef.current) {
      waveformDataManagerRef.current = new WaveformDataManager(200)
      waveformRendererRef.current = new CanvasRenderer(waveformCanvasRef.current)
    }

    if (radarCanvasRef.current) {
      radarRendererRef.current = new CanvasRenderer(radarCanvasRef.current)
    }

    animationControllerRef.current = new AnimationController(
      maxFPS,
      enablePerformanceMode,
      skipFrames
    )

    return () => {
      animationControllerRef.current?.stop()
    }
  }, [maxFPS, enablePerformanceMode, skipFrames])

  // 애니메이션 제어
  useEffect(() => {
    if (!isAnimating || !animationControllerRef.current) return

    const animate = (deltaTime: number) => {
      updateWaveform()

      // 웨이브폼 그리기
      if (waveformRendererRef.current && waveformDataManagerRef.current) {
        const data = enablePerformanceMode
          ? waveformDataManagerRef.current.getDownsampledData(100)
          : waveformDataManagerRef.current.getData()

        waveformRendererRef.current.drawWaveform(data, colors)
      }

      // 레이더 차트 그리기
      if (radarRendererRef.current) {
        radarRendererRef.current.drawRadarChart(emotion, colors)
      }

      // 성능 메트릭 업데이트
      if (enablePerformanceMode) {
        const metrics = animationControllerRef.current!.getMetrics()
        setPerformanceMetrics(metrics)
      }
    }

    animationControllerRef.current.start(animate)

    return () => {
      animationControllerRef.current?.stop()
    }
  }, [isAnimating, updateWaveform, colors, emotion, enablePerformanceMode])

  // Handle 인터페이스 구현
  useImperativeHandle(ref, () => ({
    getPerformanceMetrics: () => performanceMetrics,
    pauseAnimation: () => {
      setIsAnimating(false)
      animationControllerRef.current?.pause()
    },
    resumeAnimation: () => {
      setIsAnimating(true)
      if (animationControllerRef.current) {
        animationControllerRef.current.resume((deltaTime) => {
          updateWaveform()
          if (waveformRendererRef.current && waveformDataManagerRef.current) {
            const data = waveformDataManagerRef.current.getData()
            waveformRendererRef.current.drawWaveform(data, colors)
          }
          if (radarRendererRef.current) {
            radarRendererRef.current.drawRadarChart(emotion, colors)
          }
        })
      }
    },
    clearCanvas: () => {
      waveformRendererRef.current?.clear()
      radarRendererRef.current?.clear()
      waveformDataManagerRef.current?.clear()
    }
  }))

  // 감정 레벨 바 컴포넌트 (메모이제이션)
  const EmotionBar = React.memo<{
    label: string
    value: number
    color: string
    unit?: string
  }>(({ label, value, color, unit = '' }) => (
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
            boxShadow: animated ? `0 0 10px ${color}40` : undefined,
            transform: 'translateZ(0)', // GPU 가속
            willChange: 'width'
          }}
        />
      </div>
    </div>
  ))

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
    )
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
    )
  }

  // 상세 모드 (기본)
  return (
    <div
      className={`emotion-visualizer p-6 rounded-lg shadow-lg ${className}`}
      style={{ backgroundColor: colors.background }}
    >
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold" style={{ color: colors.text }}>
          감정 상태 분석
        </h3>

        {enablePerformanceMode && (
          <div className="text-xs text-gray-500 space-x-2">
            <span>FPS: {performanceMetrics.fps}</span>
            <span>Frame: {performanceMetrics.frameTime.toFixed(1)}ms</span>
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              className="px-2 py-1 bg-gray-200 rounded text-xs"
            >
              {isAnimating ? 'Pause' : 'Resume'}
            </button>
          </div>
        )}
      </div>

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
            value={(emotion.valence + 1) / 2}
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
            style={{ transform: 'translateZ(0)' }} // GPU 가속
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
              style={{ transform: 'translateZ(0)' }} // GPU 가속
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
  )
})

OptimizedEmotionVisualizer.displayName = 'OptimizedEmotionVisualizer'

export default OptimizedEmotionVisualizer
export type { VisualizerHandle, PerformanceMetrics }