/**
 * T005: WebSocket 실시간 통신 테스트 컴포넌트
 * 타이핑 캡처와 WebSocket 통신 기능을 종합적으로 테스트
 */

import React, { useState, useEffect } from 'react';
import { useTypingWithWebSocket } from '../hooks/useTypingWithWebSocket';
import { WebSocketConnectionState } from '../hooks/types';

interface WebSocketTestProps {
  sessionId?: string;
  className?: string;
}

export const WebSocketTest: React.FC<WebSocketTestProps> = ({
  sessionId = 'test-session-' + Date.now(),
  className = ''
}) => {
  const [inputText, setInputText] = useState('');
  const [testLogs, setTestLogs] = useState<string[]>([]);

  const {
    // 타이핑 캡처 상태
    events,
    pattern,
    isCapturing,
    performanceMetrics,

    // WebSocket 연결 상태
    connectionState,
    isConnected,
    lastError,
    reconnectAttempts,

    // 서버 응답 데이터
    emotionData,
    processingStats,

    // 제어 함수
    startCapture,
    stopCapture,
    clearBuffer,
    connect,
    disconnect,

    // 통계
    messagesReceived,
    messagesSent,
    totalTypingEvents
  } = useTypingWithWebSocket({
    sessionId,
    enabled: isCapturing,
    autoConnect: true,
    typingConfig: {
      bufferSize: 500,
      analysisWindowMs: 3000,
      performanceMode: true
    },
    websocketConfig: {
      url: process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws',
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
      heartbeatInterval: 30000
    }
  });

  // 연결 상태별 스타일 클래스
  const getConnectionStatusClass = (state: WebSocketConnectionState) => {
    switch (state) {
      case WebSocketConnectionState.CONNECTED:
        return 'text-green-600 bg-green-50 border-green-200';
      case WebSocketConnectionState.CONNECTING:
      case WebSocketConnectionState.RECONNECTING:
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case WebSocketConnectionState.ERROR:
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // 로그 추가 함수
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTestLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 49)]); // 최대 50개 로그
  };

  // 상태 변화 감지
  useEffect(() => {
    addLog(`연결 상태 변경: ${connectionState}`);
  }, [connectionState]);

  useEffect(() => {
    if (emotionData) {
      addLog(`감정 데이터 수신: E=${emotionData.energy.toFixed(2)}, V=${emotionData.valence.toFixed(2)}, T=${emotionData.tension.toFixed(2)}, F=${emotionData.focus.toFixed(2)}`);
    }
  }, [emotionData]);

  useEffect(() => {
    if (processingStats) {
      addLog(`처리 통계 수신: 버퍼=${processingStats.buffer_size}, 패턴=${processingStats.patterns_detected.length}개`);
    }
  }, [processingStats]);

  // 입력 핸들러
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  };

  // 테스트 제어 함수들
  const handleStartTest = () => {
    startCapture();
    addLog('타이핑 캡처 시작');
  };

  const handleStopTest = () => {
    stopCapture();
    addLog('타이핑 캡처 중지');
  };

  const handleClearData = () => {
    clearBuffer();
    setInputText('');
    setTestLogs([]);
    addLog('데이터 초기화 완료');
  };

  const handleReconnect = () => {
    disconnect();
    setTimeout(connect, 1000);
    addLog('수동 재연결 시도');
  };

  return (
    <div className={`max-w-6xl mx-auto p-6 space-y-6 ${className}`}>
      {/* 헤더 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          WebSocket 실시간 통신 테스트
        </h1>
        <p className="text-gray-600">
          T005: 타이핑 데이터 실시간 서버 전송 및 응답 처리 검증
        </p>
      </div>

      {/* 연결 상태 및 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 연결 상태 */}
        <div className={`p-4 rounded-lg border ${getConnectionStatusClass(connectionState)}`}>
          <h3 className="font-semibold mb-2">연결 상태</h3>
          <p className="text-sm">
            {connectionState}
            {reconnectAttempts > 0 && ` (재시도: ${reconnectAttempts}회)`}
          </p>
          <p className="text-xs mt-1">세션 ID: {sessionId}</p>
        </div>

        {/* 메시지 통계 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">메시지 통계</h3>
          <div className="text-sm text-blue-700 space-y-1">
            <p>수신: {messagesReceived}개</p>
            <p>전송: {messagesSent}개</p>
            <p>타이핑 이벤트: {totalTypingEvents}개</p>
          </div>
        </div>

        {/* 성능 지표 */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <h3 className="font-semibold text-purple-800 mb-2">성능 지표</h3>
          <div className="text-sm text-purple-700 space-y-1">
            <p>처리시간: {performanceMetrics.processingTime.toFixed(2)}ms</p>
            <p>평균: {performanceMetrics.averageProcessingTime.toFixed(2)}ms</p>
            <p>이벤트: {performanceMetrics.eventCount}개</p>
          </div>
        </div>
      </div>

      {/* 제어 버튼들 */}
      <div className="flex flex-wrap gap-2 justify-center">
        <button
          onClick={handleStartTest}
          disabled={isCapturing}
          className={`px-4 py-2 rounded-md font-medium ${
            isCapturing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isCapturing ? '캡처 중...' : '캡처 시작'}
        </button>

        <button
          onClick={handleStopTest}
          disabled={!isCapturing}
          className={`px-4 py-2 rounded-md font-medium ${
            !isCapturing
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-red-500 hover:bg-red-600 text-white'
          }`}
        >
          캡처 중지
        </button>

        <button
          onClick={handleReconnect}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium"
        >
          재연결
        </button>

        <button
          onClick={handleClearData}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md font-medium"
        >
          데이터 초기화
        </button>
      </div>

      {/* 타이핑 테스트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 타이핑 입력 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">타이핑 테스트</h3>

          <textarea
            value={inputText}
            onChange={handleInputChange}
            placeholder="여기에 타이핑하면 실시간으로 데이터가 서버로 전송됩니다..."
            className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!isCapturing}
          />

          {pattern && (
            <div className="p-3 bg-gray-50 border rounded-lg">
              <h4 className="font-medium text-sm text-gray-700 mb-2">실시간 패턴 분석</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-600">속도:</span> {pattern.averageSpeed.toFixed(1)} WPM
                </div>
                <div>
                  <span className="text-gray-600">리듬 변화:</span> {pattern.rhythmVariation.toFixed(2)}
                </div>
                <div>
                  <span className="text-gray-600">일시정지:</span> {pattern.pausePattern.length}개
                </div>
                <div>
                  <span className="text-gray-600">이벤트:</span> {pattern.events.length}개
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 감정 데이터 시각화 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">감정 분석 결과</h3>

          {emotionData ? (
            <div className="space-y-3">
              {[
                { label: '에너지', value: emotionData.energy, color: 'bg-red-500' },
                { label: '감정가', value: emotionData.valence, color: 'bg-blue-500' },
                { label: '긴장도', value: emotionData.tension, color: 'bg-orange-500' },
                { label: '집중도', value: emotionData.focus, color: 'bg-green-500' }
              ].map(({ label, value, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span>{value.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${color}`}
                      style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
              타이핑을 시작하면 감정 분석 결과가 여기에 표시됩니다
            </div>
          )}
        </div>
      </div>

      {/* 에러 표시 */}
      {lastError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2">오류 발생</h3>
          <p className="text-red-700 text-sm">{lastError}</p>
        </div>
      )}

      {/* 실시간 로그 */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">실시간 로그</h3>
        <div className="h-40 p-3 bg-gray-900 text-green-400 rounded-lg overflow-y-auto font-mono text-xs">
          {testLogs.length === 0 ? (
            <div className="text-gray-500">로그가 없습니다...</div>
          ) : (
            testLogs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 테스트 가이드 */}
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="font-semibold text-yellow-800 mb-2">테스트 가이드</h3>
        <ol className="text-yellow-700 text-sm space-y-1 list-decimal list-inside">
          <li>백엔드 서버가 실행 중인지 확인하세요 (http://localhost:8000)</li>
          <li>"캡처 시작" 버튼을 클릭하여 타이핑 캡처를 활성화하세요</li>
          <li>텍스트 영역에 타이핑하면 실시간으로 데이터가 서버로 전송됩니다</li>
          <li>연결 상태, 메시지 통계, 감정 분석 결과를 확인하세요</li>
          <li>로그 영역에서 실시간 데이터 흐름을 모니터링할 수 있습니다</li>
        </ol>
      </div>
    </div>
  );
};