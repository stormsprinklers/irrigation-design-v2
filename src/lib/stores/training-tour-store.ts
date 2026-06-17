import { create } from "zustand";
import { TRAINING_TOUR_STEPS } from "@/lib/tour/training-tour-steps";

type TrainingTourStore = {
  isActive: boolean;
  currentStep: number;
  startTour: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goToStep: (index: number) => void;
  endTour: () => void;
};

export const useTrainingTourStore = create<TrainingTourStore>((set, get) => ({
  isActive: false,
  currentStep: 0,

  startTour: () => set({ isActive: true, currentStep: 0 }),

  next: () => {
    const { currentStep } = get();
    if (currentStep >= TRAINING_TOUR_STEPS.length - 1) return;
    set({ currentStep: currentStep + 1 });
  },

  prev: () => {
    const { currentStep } = get();
    if (currentStep <= 0) return;
    set({ currentStep: currentStep - 1 });
  },

  skip: () => set({ isActive: false, currentStep: 0 }),

  goToStep: (index) => {
    if (index < 0 || index >= TRAINING_TOUR_STEPS.length) return;
    set({ currentStep: index });
  },

  endTour: () => set({ isActive: false, currentStep: 0 }),
}));
