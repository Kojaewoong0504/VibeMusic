/**
 * Performance Monitor Component
 *
 * T092: 타이핑 패턴 실시간 처리 성능 모니터링
 * - 실시간 지연시간 및 처리율 표시
 * - 성능 경고 및 최적화 제안
 * - WebSocket 연결 품질 모니터링
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Wifi, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

interface PerformanceMetrics {
  eventsProcessed: number;
  avgLatency: number;
  maxLatency: number;
  processingRate: number;
  bufferUtilization: number;
  lastUpdate: number;
}

interface WebSocketMetrics {
  connected: boolean;
  messagesReceived: number;
  messagesSent: number;
  avgRoundTrip: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

interface PerformanceMonitorProps {
  typingMetrics?: PerformanceMetrics;
  websocketMetrics?: WebSocketMetrics;
  targetLatencyMs?: number;
  showDetails?: boolean;
  onPerformanceAlert?: (alert: string) => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  typingMetrics,
  websocketMetrics,
  targetLatencyMs = 50,
  showDetails = false,
  onPerformanceAlert
}) => {
  const [alerts, setAlerts] = useState<string[]>([]);
  const [performanceGrade, setPerformanceGrade] = useState<'A' | 'B' | 'C' | 'D' | 'F'>('A');

  // 성능 등급 계산
  const calculatePerformanceGrade = useCallback(() => {
    if (!typingMetrics) return 'F';

    const latencyScore = Math.max(0, 100 - (typingMetrics.avgLatency / targetLatencyMs) * 100);
    const rateScore = Math.min(100, (typingMetrics.processingRate / 50) * 100);
    const bufferScore = 100 - typingMetrics.bufferUtilization;

    const totalScore = (latencyScore + rateScore + bufferScore) / 3;

    if (totalScore >= 90) return 'A';
    if (totalScore >= 80) return 'B';
    if (totalScore >= 70) return 'C';
    if (totalScore >= 60) return 'D';
    return 'F';
  }, [typingMetrics, targetLatencyMs]);

  // 성능 경고 체크
  const checkPerformanceAlerts = useCallback(() => {
    const newAlerts: string[] = [];

    if (typingMetrics) {
      if (typingMetrics.avgLatency > targetLatencyMs) {
        newAlerts.push(`평균 지연시간이 목표치(${targetLatencyMs}ms)를 초과했습니다`);
      }

      if (typingMetrics.maxLatency > targetLatencyMs * 2) {
        newAlerts.push(`최대 지연시간이 허용치(${targetLatencyMs * 2}ms)를 초과했습니다`);
      }

      if (typingMetrics.bufferUtilization > 80) {
        newAlerts.push('버퍼 사용률이 높습니다. 성능 저하가 발생할 수 있습니다');
      }

      if (typingMetrics.processingRate < 10) {
        newAlerts.push('처리율이 낮습니다. 입력 응답성이 저하될 수 있습니다');
      }
    }

    if (websocketMetrics) {
      if (!websocketMetrics.connected) {
        newAlerts.push('WebSocket 연결이 끊어졌습니다');
      }

      if (websocketMetrics.connectionQuality === 'poor') {
        newAlerts.push('WebSocket 연결 품질이 낮습니다');
      }

      if (websocketMetrics.avgRoundTrip > 200) {
        newAlerts.push('네트워크 지연시간이 높습니다');
      }
    }

    setAlerts(newAlerts);

    // 새 경고가 있으면 콜백 호출
    if (newAlerts.length > 0 && onPerformanceAlert) {
      newAlerts.forEach(alert => onPerformanceAlert(alert));
    }
  }, [typingMetrics, websocketMetrics, targetLatencyMs, onPerformanceAlert]);

  // 성능 메트릭 업데이트
  useEffect(() => {
    const grade = calculatePerformanceGrade();
    setPerformanceGrade(grade);
    checkPerformanceAlerts();
  }, [calculatePerformanceGrade, checkPerformanceAlerts]);

  // 상태 아이콘 렌더링
  const renderStatusIcon = (value: number, threshold: number, reverse = false) => {
    const isGood = reverse ? value < threshold : value > threshold;

    if (isGood) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else {
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    }
  };

  // 연결 품질 색상
  const getConnectionQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-500';
      case 'good': return 'text-blue-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  // 성능 등급 색상
  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      case 'F': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            성능 모니터
          </h3>
          <div className={`px-2 py-1 rounded-full text-xs font-bold text-white ${getGradeColor(performanceGrade)}`}>
            {performanceGrade}
          </div>
        </div>

        {websocketMetrics && (
          <div className="flex items-center gap-1">
            <Wifi className={`w-4 h-4 ${websocketMetrics.connected ? 'text-green-500' : 'text-red-500'}`} />
            <span className={`text-xs ${getConnectionQualityColor(websocketMetrics.connectionQuality)}`}>
              {websocketMetrics.connectionQuality}
            </span>
          </div>
        )}
      </div>

      {/* 주요 메트릭 */}
      {typingMetrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">평균 지연시간</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {typingMetrics.avgLatency.toFixed(1)}ms
                </p>
              </div>
              {renderStatusIcon(typingMetrics.avgLatency, targetLatencyMs, true)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">처리율</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {typingMetrics.processingRate.toFixed(1)}/s
                </p>
              </div>
              {renderStatusIcon(typingMetrics.processingRate, 20)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">버퍼 사용률</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {typingMetrics.bufferUtilization.toFixed(1)}%
                </p>
              </div>
              {renderStatusIcon(typingMetrics.bufferUtilization, 80, true)}
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">처리된 이벤트</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {typingMetrics.eventsProcessed.toLocaleString()}
                </p>
              </div>
              <Zap className="w-4 h-4 text-blue-500" />
            </div>
          </div>
        </div>
      )}

      {/* 상세 정보 */}
      {showDetails && typingMetrics && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            상세 메트릭
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">최대 지연시간:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {typingMetrics.maxLatency.toFixed(1)}ms
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">마지막 업데이트:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {new Date(typingMetrics.lastUpdate).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {websocketMetrics && (
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">수신 메시지:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {websocketMetrics.messagesReceived.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">송신 메시지:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {websocketMetrics.messagesSent.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">라운드트립:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {websocketMetrics.avgRoundTrip.toFixed(1)}ms
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 성능 경고 */}
      {alerts.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            성능 경고
          </h4>
          <div className="space-y-1">
            {alerts.map((alert, index) => (
              <div key={index} className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded px-2 py-1">
                {alert}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 성능 최적화 제안 */}
      {performanceGrade === 'C' || performanceGrade === 'D' || performanceGrade === 'F' ? (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            최적화 제안
          </h4>
          <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {typingMetrics?.avgLatency > targetLatencyMs && (
              <div>• 브라우저 백그라운드 탭을 닫아 CPU 사용량을 줄여보세요</div>
            )}
            {typingMetrics?.bufferUtilization > 80 && (
              <div>• 타이핑 속도를 조금 늦춰 버퍼 부하를 줄여보세요</div>
            )}
            {websocketMetrics?.connectionQuality === 'poor' && (
              <div>• 네트워크 연결을 확인하거나 WiFi 신호를 개선해보세요</div>
            )}
            <div>• 페이지를 새로고침하여 메모리를 정리해보세요</div>
          </div>
        </div>
      ) : (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle className="w-4 h-4" />
            성능이 최적 상태입니다
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceMonitor;