export interface WorkoutSet {
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  rir?: number;
  notes?: string;
}

export interface WorkoutEntry {
  exerciseId: string;
  exerciseName: string;
  sets: WorkoutSet[];
  notes?: string;
}

export interface Workout {
  id: string;
  userId: string;
  routineId: string;
  routineName: string;
  folderId?: string;
  date: Date;
  entries: WorkoutEntry[];
  notes?: string;
  totalVolume?: number;
  createdAt: Date;
}
