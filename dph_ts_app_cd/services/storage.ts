import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/navigation';

const USER_KEY = 'user_info';

export const saveUser = async (user: User): Promise<void> => {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const getUser = async (): Promise<User | null> => {
  const data = await AsyncStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const clearUser = async (): Promise<void> => {
  await AsyncStorage.removeItem(USER_KEY);
};