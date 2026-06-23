import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  brand: string;        // "합격공간"
  storeName: string;    // "분당정자점"
  managerName: string;
  setStoreName: (s: string) => void;
}

export const useBranding = create<State>()(
  persist(
    (set) => ({
      brand: '합격공간',
      storeName: '분당정자점',
      managerName: '매니저1',
      setStoreName: (s) => set({ storeName: s }),
    }),
    { name: 'pp.brand.v1' },
  ),
);
