export interface RoutineExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds?: number;
  notes?: string;
  order: number;
}

export interface Routine {
  id: string;
  userId: string;
  folderId: string;
  name: string;
  description?: string;
  day?: string;
  notes?: string;
  exercises: RoutineExercise[];
  createdAt: Date;
  updatedAt: Date;
}
