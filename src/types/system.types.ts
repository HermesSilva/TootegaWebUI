export interface ApplicationInfo {
  name: string;
  version: string;
  environment: string;
  startedAt: string;
  uptime: string;
}

export interface OperatingSystemInfo {
  name: string;
  version: string;
  architecture: string;
  machineName: string;
}

export interface HardwareInfo {
  processorCount: number;
  totalMemoryMB: number;
  availableMemoryMB: number;
  usedMemoryMB: number;
  memoryUsagePercent: number;
}

export interface DatabaseInfo {
  provider: string;
  version: string | null;
  isConnected: boolean;
}

export interface SystemInfo {
  application: ApplicationInfo;
  operatingSystem: OperatingSystemInfo;
  hardware: HardwareInfo;
  database: DatabaseInfo;
}

export interface ClientInfo {
  version: string;
  buildDate: string;
  browser: string;
  browserVersion: string;
  os: string;
  platform: string;
  language: string;
  screenResolution: string;
  windowSize: string;
  deviceMemory: string;
  cpuCores: string;
  userAgent: string;
  react: string;
  typescript: string;
  vite: string;
  tailwind: string;
}
