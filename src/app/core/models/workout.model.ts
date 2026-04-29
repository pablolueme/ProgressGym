export type WorkoutStatus = 'IN_PROGRESS' | 'COMPLETED';

export interface WorkoutSet {
  setNumber: number;
  weight?: number;
  reps?: number;
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
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  lastSavedAt?: Date;
  status: WorkoutStatus;
  entries: WorkoutEntry[];
  notes?: string;
  totalVolume?: number;
}
