import React, { createContext, JSX, useContext, useState } from 'react';
import { DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
};

// ❗ No default value
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeProviderProps = {
  children: React.ReactNode;
};

export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  const [isDark, setIsDark] = useState<boolean>(false);

  const toggleTheme = (): void => {
    setIsDark(prev => !prev);
  };

  const value: ThemeContextType = {
    theme: isDark ? DarkTheme : DefaultTheme,
    isDark,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ✅ Safe custom hook
export const useThemeContext = (): ThemeContextType => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemeContext must be used inside ThemeProvider');
  }

  return context;
};