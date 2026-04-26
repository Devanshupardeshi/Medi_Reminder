import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// One key namespace, one error policy. Hardware-backed on device,
// AsyncStorage fallback on web (preview).
const KEYS = {
  accessToken: 'medireminder.access_token',
  userJson: 'medireminder.user_json',
} as const;

async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } catch {
    // ignore — caller still has the value in memory
  }
}

async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch {
    // ignore
  }
}

export const secureStorage = {
  getAccessToken: () => getItem(KEYS.accessToken),
  setAccessToken: (token: string) => setItem(KEYS.accessToken, token),
  clearAccessToken: () => deleteItem(KEYS.accessToken),

  getUserJson: () => getItem(KEYS.userJson),
  setUserJson: (json: string) => setItem(KEYS.userJson, json),
  clearUserJson: () => deleteItem(KEYS.userJson),

  async clearAll(): Promise<void> {
    await Promise.all([
      deleteItem(KEYS.accessToken),
      deleteItem(KEYS.userJson),
    ]);
  },
};
