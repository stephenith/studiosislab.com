/**
 * SAIOS runtime — configuration types
 */

export type SaiosConfig = {
  repoRoot: string;
  sosRoot: string;
  saiosRoot: string;
  logsRoot: string;
  timezone: string;
  telegramEnabled: boolean;
  emailEnabled: boolean;
};

export type SaiosConfigLoader = {
  load(): SaiosConfig;
};
