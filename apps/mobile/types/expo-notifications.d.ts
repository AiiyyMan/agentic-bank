/**
 * Minimal type shim for expo-notifications.
 *
 * expo-notifications is not installed as a package dependency — it is loaded
 * at runtime via a dynamic require() inside useKnock.ts wrapped in try/catch,
 * so the app works without it. This shim satisfies TypeScript's type-import
 * resolution without requiring the full package to be installed.
 */
declare module 'expo-notifications' {
  export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

  export interface PermissionResponse {
    status: PermissionStatus;
    expires: 'never' | number;
    granted: boolean;
    canAskAgain: boolean;
  }

  export interface ExpoPushToken {
    type: 'expo';
    data: string;
  }

  export function getPermissionsAsync(): Promise<PermissionResponse>;
  export function requestPermissionsAsync(): Promise<PermissionResponse>;
  export function getExpoPushTokenAsync(options?: { projectId?: string }): Promise<ExpoPushToken>;
}
