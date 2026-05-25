import { create } from 'zustand';

type AuthState = {
  token: string | null;
  setToken: (token: string | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem("yapster_token"),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("yapster_token", token);
    } else {
      localStorage.removeItem("yapster_token");
    }
    set({ token });
  },
}));
