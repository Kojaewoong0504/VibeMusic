// API 클라이언트 서비스 - 바이브뮤직
// REST API 호출 래퍼, 에러 핸들링, 토큰 인증 관리

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
  timestamp: number;
}

export class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  sessionKey?: string;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  skipAuth?: boolean;
  signal?: AbortSignal;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private retryAttempts: number;
  private retryDelay: number;
  private sessionKey: string | null = null;
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  constructor(config: ApiClientConfig) {
    this.baseURL = config.baseURL;
    this.timeout = config.timeout;
    this.retryAttempts = config.retryAttempts;
    this.retryDelay = config.retryDelay;
    this.sessionKey = config.sessionKey || null;
  }

  // 세션 키 설정/해제
  setSessionKey(sessionKey: string): void {
    this.sessionKey = sessionKey;
  }

  clearSessionKey(): void {
    this.sessionKey = null;
  }

  getSessionKey(): string | null {
    return this.sessionKey;
  }

  // 기본 헤더 설정
  setDefaultHeaders(headers: Record<string, string>): void {
    this.defaultHeaders = { ...this.defaultHeaders, ...headers };
  }

  // URL 구성
  private buildURL(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    const cleanBaseURL = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    return `${cleanBaseURL}/${cleanEndpoint}`;
  }

  // 요청 헤더 구성
  private buildHeaders(options?: RequestOptions): Record<string, string> {
    const headers = { ...this.defaultHeaders };

    // 인증 헤더 추가
    if (!options?.skipAuth && this.sessionKey) {
      headers['Authorization'] = `Bearer ${this.sessionKey}`;
      headers['X-Session-Key'] = this.sessionKey;
    }

    // 추가 헤더 병합
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  }

  // 응답 검증 및 변환
  private async processResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    let data: any;
    try {
      data = isJson ? await response.json() : await response.text();
    } catch (error) {
      throw new ApiError(response.status, '응답 파싱 실패', 'PARSE_ERROR', error);
    }

    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `HTTP ${response.status}`;
      throw new ApiError(response.status, errorMessage, data?.code, data);
    }

    // 응답 형태가 ApiResponse 형태가 아닌 경우 래핑
    if (typeof data === 'object' && data !== null && 'success' in data) {
      return data as ApiResponse<T>;
    }

    return {
      success: true,
      data: data as T,
      timestamp: Date.now()
    };
  }

  // 재시도 로직
  private async retryRequest<T>(
    requestFn: () => Promise<Response>,
    attempts: number
  ): Promise<ApiResponse<T>> {
    let lastError: any;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await requestFn();
        return await this.processResponse<T>(response);
      } catch (error) {
        lastError = error;

        // 마지막 시도가 아니고 재시도 가능한 오류인 경우
        if (attempt < attempts && this.isRetryableError(error)) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  // 재시도 가능한 오류인지 확인
  private isRetryableError(error: any): boolean {
    if (error instanceof ApiError) {
      // 5xx 서버 오류나 일시적인 네트워크 오류는 재시도
      return error.status >= 500 || error.status === 429 || error.status === 408;
    }

    // 네트워크 오류는 재시도
    return error.name === 'TypeError' || error.name === 'NetworkError';
  }

  // 지연 함수
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 기본 fetch 래퍼
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeout: number,
    signal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // 외부에서 전달된 signal과 timeout signal 결합
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // GET 요청
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.timeout;
    const attempts = options?.retryAttempts || this.retryAttempts;

    return this.retryRequest<T>(
      () => this.fetchWithTimeout(
        url,
        { method: 'GET', headers },
        timeout,
        options?.signal
      ),
      attempts
    );
  }

  // POST 요청
  async post<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.timeout;
    const attempts = options?.retryAttempts || this.retryAttempts;

    const body = data ? JSON.stringify(data) : undefined;

    return this.retryRequest<T>(
      () => this.fetchWithTimeout(
        url,
        { method: 'POST', headers, body },
        timeout,
        options?.signal
      ),
      attempts
    );
  }

  // PUT 요청
  async put<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.timeout;
    const attempts = options?.retryAttempts || this.retryAttempts;

    const body = data ? JSON.stringify(data) : undefined;

    return this.retryRequest<T>(
      () => this.fetchWithTimeout(
        url,
        { method: 'PUT', headers, body },
        timeout,
        options?.signal
      ),
      attempts
    );
  }

  // DELETE 요청
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.timeout;
    const attempts = options?.retryAttempts || this.retryAttempts;

    return this.retryRequest<T>(
      () => this.fetchWithTimeout(
        url,
        { method: 'DELETE', headers },
        timeout,
        options?.signal
      ),
      attempts
    );
  }

  // PATCH 요청
  async patch<T = any>(
    endpoint: string,
    data?: any,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.timeout;
    const attempts = options?.retryAttempts || this.retryAttempts;

    const body = data ? JSON.stringify(data) : undefined;

    return this.retryRequest<T>(
      () => this.fetchWithTimeout(
        url,
        { method: 'PATCH', headers, body },
        timeout,
        options?.signal
      ),
      attempts
    );
  }

  // 파일 업로드
  async upload<T = any>(
    endpoint: string,
    file: File | Blob,
    options?: RequestOptions & { fieldName?: string; additionalData?: Record<string, any> }
  ): Promise<ApiResponse<T>> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders({ ...options, headers: { ...options?.headers } });

    // Content-Type 헤더 제거 (브라우저가 자동으로 설정)
    delete headers['Content-Type'];

    const formData = new FormData();
    formData.append(options?.fieldName || 'file', file);

    // 추가 데이터가 있으면 FormData에 추가
    if (options?.additionalData) {
      Object.entries(options.additionalData).forEach(([key, value]) => {
        formData.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      });
    }

    const timeout = options?.timeout || this.timeout;
    const attempts = options?.retryAttempts || this.retryAttempts;

    return this.retryRequest<T>(
      () => this.fetchWithTimeout(
        url,
        { method: 'POST', headers, body: formData },
        timeout,
        options?.signal
      ),
      attempts
    );
  }

  // 다운로드
  async download(
    endpoint: string,
    options?: RequestOptions
  ): Promise<Blob> {
    const url = this.buildURL(endpoint);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout || this.timeout;

    const response = await this.fetchWithTimeout(
      url,
      { method: 'GET', headers },
      timeout,
      options?.signal
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(response.status, errorText || `HTTP ${response.status}`);
    }

    return await response.blob();
  }
}

// 기본 API 클라이언트 인스턴스
const defaultConfig: ApiClientConfig = {
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api',
  timeout: 30000, // 30초
  retryAttempts: 3,
  retryDelay: 1000 // 1초
};

export const apiClient = new ApiClient(defaultConfig);

// 바이브뮤직 API 엔드포인트 래퍼
export const vibemusicApi = {
  // 세션 관리
  sessions: {
    create: () => apiClient.post('/sessions'),
    get: (sessionId: string) => apiClient.get(`/sessions/${sessionId}`),
    update: (sessionId: string, data: any) => apiClient.put(`/sessions/${sessionId}`, data),
    delete: (sessionId: string) => apiClient.delete(`/sessions/${sessionId}`)
  },

  // 타이핑 패턴 분석
  analysis: {
    analyze: (sessionId: string, data: any) =>
      apiClient.post(`/sessions/${sessionId}/analyze`, data)
  },

  // 음악 생성
  generation: {
    generate: (sessionId: string, data: any) =>
      apiClient.post(`/sessions/${sessionId}/generate`, data),
    getStatus: (sessionId: string, taskId: string) =>
      apiClient.get(`/sessions/${sessionId}/generate/${taskId}`)
  },

  // 음악 관리
  music: {
    get: (sessionId: string, musicId: string) =>
      apiClient.get(`/sessions/${sessionId}/music/${musicId}`),
    download: (sessionId: string, musicId: string) =>
      apiClient.download(`/sessions/${sessionId}/music/${musicId}/download`),
    list: (sessionId: string) =>
      apiClient.get(`/sessions/${sessionId}/music`)
  }
};

// 클래스 export
export { ApiClient };