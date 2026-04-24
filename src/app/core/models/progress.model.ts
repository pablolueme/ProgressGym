export interface ExerciseProgressItem {
  exerciseId: string;
  exerciseName: string;
  lastWeight?: number;
  bestWeight?: number;
  lastDate?: Date;
  previousWeight?: number;
}

export interface ProgressOverview {
  totalWorkouts: number;
  workoutsThisWeek: number;
  averageVolume: number;
  exerciseProgress: ExerciseProgressItem[];
}
