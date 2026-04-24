export type TrainingGoal =
  | 'Volumen'
  | 'Definicion'
  | 'Recomposicion corporal'
  | 'Fuerza'
  | 'Salud'
  | 'Otro';

export type ExperienceLevel = 'Principiante' | 'Intermedio' | 'Avanzado';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  weight?: number;
  height?: number;
  goal?: TrainingGoal;
  experienceLevel?: ExperienceLevel;
  trainingDaysPerWeek?: number;
  createdAt: Date;
  updatedAt: Date;
}
