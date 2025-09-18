/**
 * Jest setup file for testing environment
 */
import '@testing-library/jest-dom';

// JSDOM 환경 설정
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
  },
  writable: true,
});

// URL API 모킹
global.URL = {
  createObjectURL: jest.fn(() => 'mocked-object-url'),
  revokeObjectURL: jest.fn(),
} as any;

// Blob 모킹
global.Blob = jest.fn().mockImplementation((content, options) => ({
  size: content ? content.reduce((acc: number, item: any) => acc + item.length, 0) : 0,
  type: options?.type || '',
})) as any;

// FileReader 모킹 (필요시)
global.FileReader = jest.fn().mockImplementation(() => ({
  readAsText: jest.fn(),
  readAsDataURL: jest.fn(),
  onload: null,
  onerror: null,
  result: null,
})) as any;

// Fetch API 모킹
global.fetch = jest.fn();

// HTMLElement 메서드 모킹
Object.defineProperty(HTMLElement.prototype, 'click', {
  value: jest.fn(),
  writable: true,
});

// Document 메서드 모킹
const mockCreateElement = jest.fn().mockImplementation((tagName) => {
  const element = {
    tagName: tagName.toUpperCase(),
    href: '',
    download: '',
    click: jest.fn(),
    style: {},
    appendChild: jest.fn(),
    removeChild: jest.fn(),
  };
  return element;
});

Object.defineProperty(document, 'createElement', {
  value: mockCreateElement,
  writable: true,
});

Object.defineProperty(document.body, 'appendChild', {
  value: jest.fn(),
  writable: true,
});

Object.defineProperty(document.body, 'removeChild', {
  value: jest.fn(),
  writable: true,
});

// Console 경고 무시 (필요시)
const originalWarn = console.warn;
beforeEach(() => {
  console.warn = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
});