import "@testing-library/jest-dom/vitest";

// Stub IndexedDB for tests; tests that need real IDB use fake-indexeddb (added later if needed).
// For pure-logic tests, no IDB stubbing is required.
