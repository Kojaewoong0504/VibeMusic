"""Add performance optimization indexes

Revision ID: perf_optimization_001
Revises: baseline_schema
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'perf_optimization_001'
down_revision = 'baseline_schema'
branch_labels = None
depends_on = None


def upgrade():
    """Add performance optimization indexes"""

    # UserSession 테이블 최적화
    # 1. 세션 상태별 조회 최적화 (활성 세션 조회용)
    op.create_index(
        'idx_user_sessions_status_created',
        'user_sessions',
        ['status', 'created_at'],
        postgresql_using='btree'
    )

    # 2. 자동 삭제 배치 처리 최적화
    op.create_index(
        'idx_user_sessions_auto_delete_status',
        'user_sessions',
        ['auto_delete_at', 'status'],
        postgresql_using='btree',
        postgresql_where=sa.text('auto_delete_at IS NOT NULL')
    )

    # 3. 세션 토큰 조회 최적화 (이미 unique 제약이 있지만 명시적 인덱스)
    op.create_index(
        'idx_user_sessions_token_lookup',
        'user_sessions',
        ['session_token'],
        unique=True,
        postgresql_using='btree'
    )

    # 4. IP 해시 기반 세션 분석용 (옵션)
    op.create_index(
        'idx_user_sessions_ip_created',
        'user_sessions',
        ['ip_address_hash', 'created_at'],
        postgresql_using='btree',
        postgresql_where=sa.text('ip_address_hash IS NOT NULL')
    )

    # TypingPattern 테이블 최적화
    # 1. 세션별 타이핑 패턴 조회 최적화
    op.create_index(
        'idx_typing_patterns_session_created',
        'typing_patterns',
        ['session_id', 'created_at'],
        postgresql_using='btree'
    )

    # 2. JSONB 키스트로크 데이터 인덱싱 (배열 길이 기반)
    op.execute("""
        CREATE INDEX idx_typing_patterns_keystroke_count
        ON typing_patterns USING btree (jsonb_array_length(keystrokes))
    """)

    # 3. 텍스트 검색을 위한 GIN 인덱스
    op.create_index(
        'idx_typing_patterns_text_search',
        'typing_patterns',
        ['text_content'],
        postgresql_using='gin',
        postgresql_ops={'text_content': 'gin_trgm_ops'},
        postgresql_where=sa.text('text_content IS NOT NULL')
    )

    # MusicPrompt 테이블 최적화 (존재한다면)
    try:
        # 세션별 프롬프트 조회
        op.create_index(
            'idx_music_prompts_session_created',
            'music_prompts',
            ['session_id', 'created_at'],
            postgresql_using='btree'
        )
    except Exception:
        # 테이블이 없으면 무시
        pass

    # GeneratedMusic 테이블 최적화
    # 1. 상태별 음악 조회 최적화
    op.create_index(
        'idx_generated_music_status_created',
        'generated_music',
        ['status', 'created_at'],
        postgresql_using='btree'
    )

    # 2. 완료된 음악 파일 조회 최적화
    op.create_index(
        'idx_generated_music_completed',
        'generated_music',
        ['completed_at', 'status'],
        postgresql_using='btree',
        postgresql_where=sa.text("status = 'completed'")
    )

    # 3. 프롬프트별 음악 조회 (1:1 관계지만 명시적)
    op.create_index(
        'idx_generated_music_prompt',
        'generated_music',
        ['prompt_id'],
        unique=True,
        postgresql_using='btree'
    )

    # EmotionProfile 테이블 최적화 (존재한다면)
    try:
        # 타이핑 패턴별 감정 프로필 조회
        op.create_index(
            'idx_emotion_profiles_typing_pattern',
            'emotion_profiles',
            ['typing_pattern_id'],
            unique=True,
            postgresql_using='btree'
        )

        # 감정별 분석용 인덱스
        op.create_index(
            'idx_emotion_profiles_dominant_emotion',
            'emotion_profiles',
            ['dominant_emotion', 'created_at'],
            postgresql_using='btree'
        )
    except Exception:
        # 테이블이 없으면 무시
        pass


def downgrade():
    """Remove performance optimization indexes"""

    # UserSession 인덱스 제거
    op.drop_index('idx_user_sessions_status_created', table_name='user_sessions')
    op.drop_index('idx_user_sessions_auto_delete_status', table_name='user_sessions')
    op.drop_index('idx_user_sessions_token_lookup', table_name='user_sessions')
    op.drop_index('idx_user_sessions_ip_created', table_name='user_sessions')

    # TypingPattern 인덱스 제거
    op.drop_index('idx_typing_patterns_session_created', table_name='typing_patterns')
    op.drop_index('idx_typing_patterns_keystroke_count', table_name='typing_patterns')
    op.drop_index('idx_typing_patterns_text_search', table_name='typing_patterns')

    # MusicPrompt 인덱스 제거
    try:
        op.drop_index('idx_music_prompts_session_created', table_name='music_prompts')
    except Exception:
        pass

    # GeneratedMusic 인덱스 제거
    op.drop_index('idx_generated_music_status_created', table_name='generated_music')
    op.drop_index('idx_generated_music_completed', table_name='generated_music')
    op.drop_index('idx_generated_music_prompt', table_name='generated_music')

    # EmotionProfile 인덱스 제거
    try:
        op.drop_index('idx_emotion_profiles_typing_pattern', table_name='emotion_profiles')
        op.drop_index('idx_emotion_profiles_dominant_emotion', table_name='emotion_profiles')
    except Exception:
        pass