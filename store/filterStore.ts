'use client';

import { create } from 'zustand';

interface FilterState {
  selectedYear: number | null;
  selectedClient: string | null; // cod_cliente
  selectedClientName: string | null;
  selectedProduct: string | null; // cod_referencia
  selectedSemester: 1 | 2 | null;
  selectedRevenueType: string | null;
  availableYears: number[];

  setYear: (year: number | null) => void;
  setClient: (cod: string | null, name: string | null) => void;
  setProduct: (cod: string | null) => void;
  setSemester: (semester: 1 | 2 | null) => void;
  setRevenueType: (revenueType: string | null) => void;
  setAvailableYears: (years: number[]) => void;
  clearFilters: () => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedYear: null,
  selectedClient: null,
  selectedClientName: null,
  selectedProduct: null,
  selectedSemester: null,
  selectedRevenueType: null,
  availableYears: [],

  setYear: (year) => set({ selectedYear: year }),
  setClient: (cod, name) => set({ selectedClient: cod, selectedClientName: name }),
  setProduct: (cod) => set({ selectedProduct: cod }),
  setSemester: (semester) => set({ selectedSemester: semester }),
  setRevenueType: (revenueType) => set({ selectedRevenueType: revenueType }),
  setAvailableYears: (years) => set({ availableYears: years }),
  clearFilters: () =>
    set({
      selectedYear: null,
      selectedClient: null,
      selectedClientName: null,
      selectedProduct: null,
      selectedSemester: null,
      selectedRevenueType: null,
    }),
}));
