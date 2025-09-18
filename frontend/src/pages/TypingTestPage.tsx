/**
 * T004 전용 테스트 페이지
 * 타이핑 이벤트 캡처 시스템 검증 및 브라우저 호환성 테스트
 */
import React from 'react';
import { Header } from '../components';
import { TypingCaptureTest } from '../components/TypingCaptureTest';

const TypingTestPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        sessionInfo={{
          id: 'test-session',
          startTime: new Date(),
          isActive: true,
          musicCount: 0
        }}
      />
      <div className="container mx-auto px-4 py-8">
        <TypingCaptureTest />
      </div>
    </div>
  );
};

export default TypingTestPage;