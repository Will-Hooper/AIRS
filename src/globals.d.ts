declare global {
  interface Window {
    AIRS_RUNTIME_CONFIG?: {
      strictDataMode?: boolean | string | null;
      environment?: string | null;
    };
  }
}

export {};
