/* eslint-disable @typescript-eslint/no-unused-vars */
// src/types/process.d.ts
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      REACT_APP_API_URL?: string;
      // Add other environment variables as needed
    }
  }
}

// Ensure process is available
declare const process: {
  env: NodeJS.ProcessEnv;
};

export {};