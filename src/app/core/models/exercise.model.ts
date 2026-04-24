export type ExerciseType =
  | 'Maquina'
  | 'Polea'
  | 'Peso libre'
  | 'Mancuernas'
  | 'Barra'
  | 'Multipower'
  | 'Corporal'
  | 'Cardio'
  | 'Otro';

export interface Exercise {
  id: string;
  userId: string;
  name: string;
  muscleGroup: string;
  secondaryMuscles?: string[];
  type: ExerciseType;
  description?: string;
  technique?: string;
  tips?: string;
  commonMistakes?: string;
  personalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}
