import { createSlice } from '@reduxjs/toolkit';

const getInitialTheme = () => {
  const cookieTheme = document.cookie
    .split('; ')
    .find((c) => c.startsWith('theme='))
    ?.split('=')[1];
  
  if (cookieTheme) return cookieTheme;
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

const initialState = {
  mode: getInitialTheme(),
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
      
      // Sync with DOM and Cookies
      if (state.mode === 'dark') {
        document.documentElement.dataset.theme = 'dark';
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      document.cookie = `theme=${state.mode}; path=/; max-age=${60 * 60 * 24 * 365}`;
    },
    setTheme: (state, action) => {
      state.mode = action.payload;
      if (state.mode === 'dark') {
        document.documentElement.dataset.theme = 'dark';
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    }
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
