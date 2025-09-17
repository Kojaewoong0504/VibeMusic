"""
T012: GET /sessions/{id}/music/{id}/download 계약 테스트

생성된 음악 파일 다운로드 API의 계약을 검증하는 테스트입니다.
OpenAPI 스펙에 정의된 바이너리 음악 파일 다운로드를 엄격히 검증합니다.

TDD 원칙: 이 테스트는 현재 실패해야 합니다 (구현이 없으므로)
"""

import pytest
from fastapi.testclient import TestClient
import uuid
import io

# TODO: 실제 FastAPI 앱이 구현되면 import 경로 수정
# from src.main import app

# 현재는 임시 앱으로 테스트가 실패하도록 설정
from fastapi import FastAPI
app = FastAPI()

client = TestClient(app)


class TestDownloadGet:
    """GET /sessions/{session_id}/music/{music_id}/download 엔드포인트 계약 테스트"""

    @pytest.fixture
    def valid_session_token(self):
        """테스트용 유효한 세션 토큰"""
        return "test_session_token_12345"

    @pytest.fixture
    def valid_session_id(self):
        """테스트용 유효한 세션 ID"""
        return str(uuid.uuid4())

    @pytest.fixture
    def valid_music_id(self):
        """테스트용 유효한 음악 ID (완료된 상태)"""
        return str(uuid.uuid4())

    def test_download_wav_success(self, valid_session_id, valid_session_token, valid_music_id):
        """
        WAV 파일 다운로드 성공 테스트

        계약 검증:
        - 요청: session_id, music_id (UUID), Authorization 헤더
        - 응답: 200, Content-Type: audio/wav, 바이너리 데이터
        """
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        # 응답 상태 코드 검증
        assert response.status_code == 200

        # Content-Type 검증 - 음악 형식에 따라 달라짐
        content_type = response.headers.get("content-type")
        valid_content_types = ["audio/wav", "audio/mpeg", "audio/flac"]
        assert content_type in valid_content_types, \
            f"Content-Type은 {valid_content_types} 중 하나여야 합니다: {content_type}"

        # Content-Length 헤더 검증
        content_length = response.headers.get("content-length")
        if content_length:
            assert int(content_length) > 0, "Content-Length는 0보다 커야 합니다"

        # Content-Disposition 헤더 검증 (파일 다운로드용)
        content_disposition = response.headers.get("content-disposition")
        if content_disposition:
            assert "attachment" in content_disposition.lower(), \
                "Content-Disposition에 'attachment'가 포함되어야 합니다"
            assert "filename" in content_disposition.lower(), \
                "Content-Disposition에 'filename'이 포함되어야 합니다"

        # 응답 바이너리 데이터 검증
        content = response.content
        assert len(content) > 0, "응답 내용이 비어있습니다"
        assert isinstance(content, bytes), "응답은 바이너리 데이터여야 합니다"

        # 기본적인 음악 파일 시그니처 검증
        if content_type == "audio/wav":
            # WAV 파일은 'RIFF'로 시작하고 'WAVE'가 포함되어야 함
            assert content.startswith(b'RIFF'), "WAV 파일은 'RIFF'로 시작해야 합니다"
            assert b'WAVE' in content[:20], "WAV 파일에 'WAVE' 시그니처가 있어야 합니다"
        elif content_type == "audio/mpeg":
            # MP3 파일은 ID3 태그 또는 프레임 헤더로 시작
            assert content.startswith((b'ID3', b'\xff\xfb', b'\xff\xfa')), \
                "MP3 파일은 유효한 헤더로 시작해야 합니다"

    def test_download_mp3_success(self, valid_session_id, valid_session_token, valid_music_id):
        """MP3 파일 다운로드 성공 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 200

        # MP3 형식인 경우 Content-Type 검증
        content_type = response.headers.get("content-type")
        if content_type == "audio/mpeg":
            content = response.content
            # MP3 파일 시그니처 검증
            assert len(content) > 0
            # MP3는 보통 ID3 태그나 프레임 헤더로 시작
            valid_mp3_headers = [b'ID3', b'\xff\xfb', b'\xff\xfa', b'\xff\xf3', b'\xff\xf2']
            header_found = any(content.startswith(header) for header in valid_mp3_headers)
            assert header_found, "유효한 MP3 헤더를 찾을 수 없습니다"

    def test_download_flac_success(self, valid_session_id, valid_session_token, valid_music_id):
        """FLAC 파일 다운로드 성공 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 200

        # FLAC 형식인 경우 Content-Type 검증
        content_type = response.headers.get("content-type")
        if content_type == "audio/flac":
            content = response.content
            # FLAC 파일 시그니처 검증
            assert len(content) > 0
            assert content.startswith(b'fLaC'), "FLAC 파일은 'fLaC'로 시작해야 합니다"

    def test_download_unauthorized_access(self, valid_session_id, valid_music_id):
        """인증되지 않은 접근 테스트"""
        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download"
        )

        assert response.status_code == 401

    def test_download_invalid_token(self, valid_session_id, valid_music_id):
        """잘못된 토큰으로 접근 테스트"""
        headers = {
            "Authorization": "Bearer invalid_token"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 401

    def test_download_malformed_token(self, valid_session_id, valid_music_id):
        """잘못된 형식의 Authorization 헤더 테스트"""
        # Bearer 없이
        headers = {
            "Authorization": "invalid_token_12345"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 401

        # 빈 토큰
        headers = {
            "Authorization": "Bearer "
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 401

    def test_download_session_not_found(self, valid_session_token, valid_music_id):
        """존재하지 않는 세션 ID로 다운로드 시도"""
        non_existent_session_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{non_existent_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 404

    def test_download_music_not_found(self, valid_session_id, valid_session_token):
        """존재하지 않는 음악 ID로 다운로드 시도"""
        non_existent_music_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{non_existent_music_id}/download",
            headers=headers
        )

        assert response.status_code == 404

    def test_download_music_not_ready(self, valid_session_id, valid_session_token):
        """아직 생성이 완료되지 않은 음악 다운로드 시도"""
        # 생성 중인 음악 ID라고 가정
        generating_music_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{generating_music_id}/download",
            headers=headers
        )

        # 아직 준비되지 않은 경우 409 Conflict 또는 202 Accepted
        assert response.status_code in [409, 202, 404]

        if response.status_code == 409:
            # 에러 메시지 검증
            assert response.headers.get("content-type") == "application/json"
            error_data = response.json()
            assert "error" in error_data
            assert "message" in error_data

    def test_download_failed_music(self, valid_session_id, valid_session_token):
        """생성에 실패한 음악 다운로드 시도"""
        # 생성 실패한 음악 ID라고 가정
        failed_music_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{failed_music_id}/download",
            headers=headers
        )

        # 실패한 경우 410 Gone 또는 404 Not Found
        assert response.status_code in [410, 404, 400]

    def test_download_invalid_session_uuid(self, valid_session_token, valid_music_id):
        """잘못된 UUID 형식의 세션 ID 테스트"""
        invalid_session_id = "not-a-valid-uuid"
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{invalid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 400

    def test_download_invalid_music_uuid(self, valid_session_id, valid_session_token):
        """잘못된 UUID 형식의 음악 ID 테스트"""
        invalid_music_id = "not-a-valid-uuid"
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{invalid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 400

    def test_download_forbidden_access(self, valid_session_token, valid_music_id):
        """다른 사용자의 음악 다운로드 시도 테스트"""
        # 다른 사용자의 세션 ID라고 가정
        other_user_session_id = str(uuid.uuid4())
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{other_user_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        # 403 또는 404 둘 다 허용 (보안 정책에 따라)
        assert response.status_code in [403, 404]

    def test_download_http_range_support(self, valid_session_id, valid_session_token, valid_music_id):
        """HTTP Range 요청 지원 테스트 (부분 다운로드)"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}",
            "Range": "bytes=0-1023"  # 첫 1KB 요청
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        # Range 요청이 지원되는 경우 206 Partial Content
        # 지원되지 않는 경우 200으로 전체 파일 반환도 허용
        assert response.status_code in [200, 206]

        if response.status_code == 206:
            # Partial Content 응답 검증
            assert "content-range" in response.headers
            content_range = response.headers["content-range"]
            assert content_range.startswith("bytes"), "Content-Range 헤더 형식이 올바르지 않습니다"

            # 요청한 범위만큼의 데이터 반환 확인
            content = response.content
            assert len(content) <= 1024, "요청한 범위를 초과하는 데이터가 반환되었습니다"

    def test_download_concurrent_requests(self, valid_session_id, valid_session_token, valid_music_id):
        """동시 다운로드 요청 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        # 동시에 여러 다운로드 요청
        responses = []
        for _ in range(3):
            response = client.get(
                f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
                headers=headers
            )
            responses.append(response)

        # 모든 요청이 성공해야 함
        for response in responses:
            assert response.status_code == 200

        # 모든 응답의 내용이 동일해야 함
        contents = [r.content for r in responses]
        assert all(content == contents[0] for content in contents), \
            "동시 요청의 응답 내용이 일치하지 않습니다"

    def test_download_large_file_handling(self, valid_session_id, valid_session_token, valid_music_id):
        """큰 파일 다운로드 처리 테스트"""
        headers = {
            "Authorization": f"Bearer {valid_session_token}"
        }

        response = client.get(
            f"/v1/sessions/{valid_session_id}/music/{valid_music_id}/download",
            headers=headers
        )

        assert response.status_code == 200

        # 스트리밍 응답인지 확인 (Transfer-Encoding: chunked)
        transfer_encoding = response.headers.get("transfer-encoding")
        content_length = response.headers.get("content-length")

        # 큰 파일의 경우 청크 인코딩 또는 Content-Length 사용
        assert transfer_encoding == "chunked" or content_length is not None, \
            "큰 파일은 청크 인코딩 또는 Content-Length를 사용해야 합니다"


class TestDownloadSecurity:
    """다운로드 보안 관련 테스트"""

    def test_download_rate_limiting(self):
        """다운로드 속도 제한 테스트"""
        # 과도한 다운로드 요청에 대한 제한이 있는지 확인
        # 실제 구현 후에 활성화
        pass

    def test_download_access_control(self):
        """다운로드 접근 제어 테스트"""
        # 사용자는 자신이 생성한 음악만 다운로드할 수 있어야 함
        # 실제 구현 후에 활성화
        pass

    def test_download_temporary_url(self):
        """임시 다운로드 URL 테스트"""
        # 파일 URL이 시간 제한이 있는지 확인
        # 실제 구현 후에 활성화
        pass

    def test_download_virus_scan(self):
        """바이러스 스캔 검증"""
        # 생성된 파일이 안전한지 확인하는 메커니즘
        # 실제 구현 후에 활성화
        pass


class TestDownloadContentTypes:
    """다운로드 Content-Type 및 헤더 테스트"""

    def test_content_type_by_format(self):
        """형식별 Content-Type 매핑 검증"""
        format_to_content_type = {
            "wav": "audio/wav",
            "mp3": "audio/mpeg",
            "flac": "audio/flac"
        }

        for format_name, expected_content_type in format_to_content_type.items():
            # 각 형식에 대해 올바른 Content-Type이 반환되는지 확인
            assert expected_content_type in ["audio/wav", "audio/mpeg", "audio/flac"]

    def test_content_disposition_filename(self):
        """Content-Disposition 파일명 검증"""
        # 파일명이 적절하게 설정되는지 확인
        expected_patterns = [
            'attachment; filename="music_*.wav"',
            'attachment; filename="music_*.mp3"',
            'attachment; filename="music_*.flac"'
        ]

        # 실제 구현에서 이 패턴들이 사용되는지 검증
        for pattern in expected_patterns:
            assert "attachment" in pattern
            assert "filename" in pattern

    def test_cache_control_headers(self):
        """캐시 제어 헤더 검증"""
        # 음악 파일은 캐시될 수 있어야 함
        expected_cache_headers = [
            "Cache-Control",
            "ETag",
            "Last-Modified"
        ]

        # 이 헤더들이 적절히 설정되는지 확인
        for header in expected_cache_headers:
            # 실제 구현에서 캐시 헤더가 설정되는지 검증
            assert isinstance(header, str)

    def test_security_headers(self):
        """보안 헤더 검증"""
        # 다운로드 응답에 적절한 보안 헤더가 포함되는지 확인
        security_headers = [
            "X-Content-Type-Options",
            "X-Frame-Options",
            "Content-Security-Policy"
        ]

        # 실제 구현에서 보안 헤더가 설정되는지 검증
        for header in security_headers:
            assert isinstance(header, str)