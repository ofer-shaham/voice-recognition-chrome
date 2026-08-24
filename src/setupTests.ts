// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { vi } from 'vitest';

if (typeof globalThis.regeneratorRuntime === 'undefined') {
    Object.defineProperty(globalThis, 'regeneratorRuntime', {
        value: {
            wrap: (fn: unknown) => fn,
            mark: (fn: unknown) => fn,
        },
        configurable: true,
    });
}

if (typeof window !== 'undefined' && !window.location) {
    Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        configurable: true,
    });
}

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('not available in test')),
    },
    configurable: true,
});
