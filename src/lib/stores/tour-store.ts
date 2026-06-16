import { create } from "zustand";
import { DESIGN_TOUR_STEPS } from "@/lib/tour/design-tour-steps";

type TourStore = {
  isActive: boolean;
  currentStep: number;
  startTour: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goToStep: (index: number) => void;
  endTour: () => void;
};

export const useTourStore = create<TourStore>((set, get) => ({
  isActive: false,
  currentStep: 0,

  startTour: () => set({ isActive: true, currentStep: 0 }),

  next: () => {
    const { currentStep } = get();
    if (currentStep >= DESIGN_TOUR_STEPS.length - 1) return;
    set({ currentStep: currentStep + 1 });
  },

  prev: () => {
    const { currentStep } = get();
    if (currentStep <= 0) return;
    set({ currentStep: currentStep - 1 });
  },

  skip: () => set({ isActive: false, currentStep: 0 }),

  goToStep: (index) => {
    if (index < 0 || index >= DESIGN_TOUR_STEPS.length) return;
    set({ currentStep: index });
  },

  endTour: () => set({ isActive: false, currentStep: 0 }),
}));
