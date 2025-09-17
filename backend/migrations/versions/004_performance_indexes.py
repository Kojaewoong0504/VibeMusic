"""Performance optimization indexes

Revision ID: 004_performance_indexes
Revises: 003_websocket_sessions
Create Date: 2025-09-16 12:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '004_performance_indexes'
down_revision = '003_websocket_sessions'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """성능 최적화를 위한 인덱스 추가"""

    # UserSession 성능 인덱스
    # 1. 활성 세션 조회 최적화 (status + start_time)
    op.create_index(
        'idx_user_sessions_status_start_time',
        'user_sessions',
        ['status', 'start_time'],
        postgresql_where=sa.text("status = 'active'")
    )

    # 2. 세션 만료 처리 최적화 (auto_delete_at)
    op.create_index(
        'idx_user_sessions_auto_delete_at',
        'user_sessions',
        ['auto_delete_at'],
        postgresql_where=sa.text("auto_delete_at IS NOT NULL AND status IN ('active', 'completed', 'abandoned')")
    )

    # 3. 세션 토큰 조회 최적화 (이미 unique 제약이 있지만 성능 향상)
    op.create_index(
        'idx_user_sessions_session_token_hash',
        'user_sessions',
        [sa.text('md5(session_token)')],
        postgresql_using='hash'
    )

    # 4. 시간 범위 쿼리 최적화
    op.create_index(
        'idx_user_sessions_created_at_desc',
        'user_sessions',
        [sa.text('created_at DESC')]
    )

    # TypingPattern 성능 인덱스
    # 5. 세션별 패턴 조회 최적화 (이미 FK 인덱스 있음)
    op.create_index(
        'idx_typing_patterns_session_created',
        'typing_patterns',
        ['session_id', 'created_at']
    )

    # 6. 키스트로크 데이터 검색 최적화 (JSONB GIN 인덱스)
    op.create_index(
        'idx_typing_patterns_keystrokes_gin',
        'typing_patterns',
        ['keystrokes'],
        postgresql_using='gin'
    )

    # 7. 텍스트 내용 검색 최적화
    op.create_index(
        'idx_typing_patterns_text_content_gin',
        'typing_patterns',
        [sa.text('to_tsvector(\'english\', text_content)')],
        postgresql_using='gin',
        postgresql_where=sa.text("text_content IS NOT NULL")
    )

    # EmotionProfile 성능 인덱스
    # 8. 감정 벡터 검색 최적화
    op.create_index(
        'idx_emotion_profiles_vectors_gin',
        'emotion_profiles',
        ['emotion_vectors'],
        postgresql_using='gin'
    )

    # 9. 에너지 레벨별 검색 최적화
    op.create_index(
        'idx_emotion_profiles_energy_level',
        'emotion_profiles',
        ['energy_level'],
        postgresql_where=sa.text("energy_level IS NOT NULL")
    )

    # GeneratedMusic 성능 인덱스
    # 10. 상태별 음악 조회 최적화
    op.create_index(
        'idx_generated_music_status_created',
        'generated_music',
        ['status', 'created_at']
    )

    # 11. 생성 시간 범위 쿼리 최적화
    op.create_index(
        'idx_generated_music_generation_time',
        'generated_music',
        ['generation_time'],
        postgresql_where=sa.text("generation_time IS NOT NULL")
    )

    # 12. 품질 점수 기반 정렬 최적화
    op.create_index(
        'idx_generated_music_quality_score_desc',
        'generated_music',
        [sa.text('quality_score DESC NULLS LAST')]
    )

    # 복합 쿼리 최적화
    # 13. 세션별 최신 음악 조회 최적화
    op.create_index(
        'idx_generated_music_session_status_created',
        'generated_music',
        ['session_id', 'status', sa.text('created_at DESC')]
    )

    # 14. 만료된 생성 중인 음악 찾기 최적화
    op.create_index(
        'idx_generated_music_timeout_cleanup',
        'generated_music',
        ['status', 'created_at'],
        postgresql_where=sa.text("status = 'generating'")
    )

    # 통계 및 집계 쿼리 최적화
    # 15. 일별 통계 조회 최적화
    op.create_index(
        'idx_user_sessions_created_date',
        'user_sessions',
        [sa.text('DATE(created_at)')]
    )

    # 16. 타이핑 통계 집계 최적화
    op.create_index(
        'idx_user_sessions_typing_stats',
        'user_sessions',
        ['total_typing_time', 'total_music_generated'],
        postgresql_where=sa.text("status = 'completed'")
    )


def downgrade() -> None:
    """인덱스 제거"""

    # 역순으로 인덱스 제거
    op.drop_index('idx_user_sessions_typing_stats', table_name='user_sessions')
    op.drop_index('idx_user_sessions_created_date', table_name='user_sessions')
    op.drop_index('idx_generated_music_timeout_cleanup', table_name='generated_music')
    op.drop_index('idx_generated_music_session_status_created', table_name='generated_music')
    op.drop_index('idx_generated_music_quality_score_desc', table_name='generated_music')
    op.drop_index('idx_generated_music_generation_time', table_name='generated_music')
    op.drop_index('idx_generated_music_status_created', table_name='generated_music')
    op.drop_index('idx_emotion_profiles_energy_level', table_name='emotion_profiles')
    op.drop_index('idx_emotion_profiles_vectors_gin', table_name='emotion_profiles')
    op.drop_index('idx_typing_patterns_text_content_gin', table_name='typing_patterns')
    op.drop_index('idx_typing_patterns_keystrokes_gin', table_name='typing_patterns')
    op.drop_index('idx_typing_patterns_session_created', table_name='typing_patterns')
    op.drop_index('idx_user_sessions_created_at_desc', table_name='user_sessions')
    op.drop_index('idx_user_sessions_session_token_hash', table_name='user_sessions')
    op.drop_index('idx_user_sessions_auto_delete_at', table_name='user_sessions')
    op.drop_index('idx_user_sessions_status_start_time', table_name='user_sessions')