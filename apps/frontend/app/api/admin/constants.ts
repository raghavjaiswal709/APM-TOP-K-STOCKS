export const CONTAINERS = {
  'fyers-5001': 'daks-fyers-5001',
  'fyers-5010': 'daks-fyers-5010',
  'backend':    'daks-backend',
  'frontend':   'daks-frontend',
} as const;

export type ContainerKey = keyof typeof CONTAINERS;
