/**
 * T004 검증용 타이핑 캡처 테스트 컴포넌트
 */
import React, { useState } from 'react';
import { useEnhancedTypingCapture } from '../hooks/useEnhancedTypingCapture';

interface TypingCaptureTestProps {
  className?: string;
}

export const TypingCaptureTest: React.FC<TypingCaptureTestProps> = ({ className = '' }) => {
  const [testText, setTestText] = useState('');
  const [showMetrics, setShowMetrics] = useState(true);

  const {
    events,
    pattern,
    isCapturing,
    startCapture,
    stopCapture,
    clearBuffer,
    performanceMetrics
  } = useEnhancedTypingCapture({
    enabled: false, // 수동 제어
    bufferSize: 500,
    analysisWindowMs: 3000,
    performanceMode: true
  });

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTestText(e.target.value);
  };

  const formatEventForDisplay = (event: any) => ({
    key: event.key === ' ' ? '스페이스' : event.key,
    duration: event.duration ? `${event.duration}ms` : '계산중',
    interval: event.interval ? `${event.interval}ms` : '첫 키',
    isBackspace: event.isBackspace ? '백스페이스' : '일반',
    timestamp: new Date(event.timestamp).toLocaleTimeString()
  });

  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          🎯 T004: 타이핑 이벤트 캡처 시스템 테스트
        </h2>
        <p className="text-gray-600">
          이 컴포넌트는 T004 요구사항을 검증하기 위한 테스트 도구입니다.
        </p>
      </div>

      {/* 제어 버튼 */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={isCapturing ? stopCapture : startCapture}
          className={`px-4 py-2 rounded font-medium ${
            isCapturing
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isCapturing ? '⏹️ 캡처 중지' : '▶️ 캡처 시작'}
        </button>
        <button
          onClick={clearBuffer}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded font-medium"
        >
          🧹 버퍼 클리어
        </button>
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium"
        >
          {showMetrics ? '📊 메트릭 숨기기' : '📊 메트릭 보기'}
        </button>
      </div>

      {/* 캡처 상태 표시 */}
      <div className="mb-4 p-3 rounded" style={{
        backgroundColor: isCapturing ? '#dcfce7' : '#fee2e2',
        border: `2px solid ${isCapturing ? '#16a34a' : '#dc2626'}`
      }}>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isCapturing ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-medium">
            {isCapturing ? '🎯 타이핑 캡처 활성화됨' : '⏸️ 타이핑 캡처 비활성화됨'}
          </span>
        </div>
      </div>

      {/* 테스트 텍스트 입력 영역 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          📝 테스트 텍스트 입력 (여기에 타이핑하여 캡처 테스트)
        </label>
        <textarea
          value={testText}
          onChange={handleTextChange}
          placeholder={
            isCapturing
              ? "여기에 타이핑하여 이벤트 캡처를 테스트하세요..."
              : "먼저 '캡처 시작' 버튼을 클릭하세요"
          }
          className="w-full h-24 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={!isCapturing}
        />
        <p className="text-sm text-gray-500 mt-1">
          글자 수: {testText.length} | 캡처된 이벤트: {events.length}
        </p>
      </div>

      {/* 성능 메트릭 */}
      {showMetrics && (
        <div className="mb-6 p-4 bg-gray-50 rounded-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">⚡ 성능 메트릭</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">마지막 처리 시간</div>
              <div className="text-xl font-bold text-blue-600">
                {performanceMetrics.processingTime.toFixed(2)}ms
              </div>
              <div className="text-xs text-gray-500">
                {performanceMetrics.processingTime < 5 ? '✅ 목표 달성 (<5ms)' : '⚠️ 목표 미달성'}
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">평균 처리 시간</div>
              <div className="text-xl font-bold text-green-600">
                {performanceMetrics.averageProcessingTime.toFixed(2)}ms
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">총 이벤트 수</div>
              <div className="text-xl font-bold text-purple-600">
                {performanceMetrics.eventCount}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 현재 타이핑 패턴 */}
      {pattern && (
        <div className="mb-6 p-4 bg-blue-50 rounded-md">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">📊 실시간 타이핑 패턴</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">평균 속도</div>
              <div className="text-xl font-bold text-indigo-600">
                {pattern.averageSpeed} WPM
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">리듬 변화도</div>
              <div className="text-xl font-bold text-purple-600">
                {pattern.rhythmVariation.toFixed(2)}
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">일시정지 횟수</div>
              <div className="text-xl font-bold text-orange-600">
                {pattern.pausePattern.length}
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow-sm">
              <div className="text-sm text-gray-600">총 이벤트</div>
              <div className="text-xl font-bold text-green-600">
                {pattern.events.length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 최근 이벤트 목록 */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">
          🔍 최근 타이핑 이벤트 (최신 10개)
        </h3>
        {events.length === 0 ? (
          <div className="text-gray-500 text-center py-4">
            아직 캡처된 이벤트가 없습니다. 위의 텍스트 영역에 타이핑을 시작하세요.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border border-gray-200 rounded-md">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">키</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">지속시간</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">간격</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">타입</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {events.slice(-10).reverse().map((event, index) => {
                  const displayEvent = formatEventForDisplay(event);
                  return (
                    <tr key={`${event.timestamp}-${index}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-mono bg-gray-100 rounded">
                        {displayEvent.key}
                      </td>
                      <td className="px-3 py-2 text-sm">{displayEvent.duration}</td>
                      <td className="px-3 py-2 text-sm">{displayEvent.interval}</td>
                      <td className="px-3 py-2 text-sm">
                        <span className={event.isBackspace ? 'text-red-600' : 'text-green-600'}>
                          {displayEvent.isBackspace}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-600">
                        {displayEvent.timestamp}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* T004 요구사항 검증 체크리스트 */}
      <div className="mt-6 p-4 bg-green-50 rounded-md">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">✅ T004 요구사항 검증</h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-sm">키보드 이벤트 리스너 구현 ✅</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-sm">타이핑 패턴 데이터 구조 정의 (TypingEvent, TypingPattern) ✅</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span className="text-sm">실시간 패턴 수집 로직 구현 ✅</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${
              performanceMetrics.processingTime < 5 ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            <span className="text-sm">
              성능 요구사항 ({performanceMetrics.processingTime < 5 ? '✅' : '⚠️'} &lt;5ms 처리시간)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TypingCaptureTest;