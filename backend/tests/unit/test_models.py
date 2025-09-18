"""
테스트: UserSession 모델 및 관련 모델 검증
"""
import pytest
from datetime import datetime, timedelta
from src.models.user_session import UserSession


def test_user_session_creation():
    """UserSession 모델 생성 테스트"""
    session = UserSession(
        session_token="test-token-123",
        consent_given=True,
        user_agent="Test Browser",
        ip_address_hash="hash123"
    )

    # 필수 필드 확인
    assert session.session_token == "test-token-123"
    assert session.consent_given is True
    assert session.status == "active"  # 기본값
    assert session.total_typing_time == 0  # 기본값
    assert session.total_music_generated == 0  # 기본값
    assert session.auto_delete_at is not None  # 자동 설정


def test_user_session_fields_exist():
    """UserSession 모델의 모든 필수 필드 존재 확인"""
    session = UserSession()

    # T001에서 수정한 필드들 확인
    assert hasattr(session, 'total_music_generated')
    assert hasattr(session, 'session_metadata')
    assert hasattr(session, 'session_token')
    assert hasattr(session, 'consent_given')
    assert hasattr(session, 'status')
    assert hasattr(session, 'total_typing_time')


def test_user_session_methods():
    """UserSession 모델의 메서드들 테스트"""
    session = UserSession(
        session_token="test-token",
        consent_given=True
    )

    # 활성 상태 확인
    assert session.is_active() is True

    # 음악 개수 증가
    session.increment_music_count()
    assert session.total_music_generated == 1

    # 타이핑 시간 업데이트
    session.update_typing_time(60)
    assert session.total_typing_time == 60

    # 세션 완료
    session.complete_session()
    assert session.status == "completed"
    assert session.is_active() is False


def test_user_session_to_dict():
    """UserSession to_dict 메서드 테스트"""
    session = UserSession(
        session_token="test-token",
        consent_given=True
    )

    data = session.to_dict()

    # 필수 필드들이 딕셔너리에 포함되어 있는지 확인
    assert 'id' in data
    assert 'session_token' in data
    assert 'status' in data
    assert 'total_typing_time' in data
    assert 'total_music_generated' in data  # T001에서 수정한 필드
    assert 'consent_given' in data
    assert 'is_active' in data
    assert 'is_expired' in data


def test_user_session_database_save(db_session):
    """데이터베이스 저장 및 조회 테스트"""
    session = UserSession(
        session_token="db-test-token",
        consent_given=True,
        user_agent="Test Browser",
        total_music_generated=5
    )

    # 데이터베이스에 저장
    db_session.add(session)
    db_session.commit()

    # 조회 및 확인
    saved_session = db_session.query(UserSession).filter_by(
        session_token="db-test-token"
    ).first()

    assert saved_session is not None
    assert saved_session.session_token == "db-test-token"
    assert saved_session.total_music_generated == 5
    assert saved_session.consent_given is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])