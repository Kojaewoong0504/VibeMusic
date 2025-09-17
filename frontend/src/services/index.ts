// Services 통합 export - 바이브뮤직
// API 클라이언트 및 WebSocket 관리자 서비스

// API 클라이언트
export {
  apiClient,
  vibemusicApi,
  ApiClient,
  ApiError
} from './api';

export type {
  ApiResponse,
  ApiClientConfig,
  RequestOptions
} from './api';

// WebSocket 관리자
export {
  websocketManager,
  vibemusicWebSocket,
  WebSocketManager
} from './websocket';

export type {
  MessageHandler,
  ErrorHandler,
  ConnectionHandler,
  MessageRoute,
  QueuedMessage,
  WebSocketManagerConfig,
  ConnectionStats,
  BackpressureInfo
} from './websocket';