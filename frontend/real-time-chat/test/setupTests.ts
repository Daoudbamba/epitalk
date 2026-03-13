// Vitest setup file
import "@testing-library/jest-dom";

// Ensure a WebSocket global exists for components/tests that reference WebSocket
if (typeof (globalThis as any).WebSocket === "undefined") {
  // Minimal mock with OPEN constant
  (globalThis as any).WebSocket = class {
    static OPEN = 1;
  };
}
