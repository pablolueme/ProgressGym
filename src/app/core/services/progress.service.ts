import { inject, Injectable } from '@angular/core';
import { combineLatest, map, Observable } from 'rxjs';
import { ProgressOverview } from '../models';
import { ExerciseService } from './exercise.service';
import { WorkoutService } from './workout.service';

@Injectable({ providedIn: 'root' })
export class ProgressService {
  private readonly workoutService = inject(WorkoutService);
  private readonly exerciseService = inject(ExerciseService);

  readonly overview$: Observable<ProgressOverview> = combineLatest([
    this.workoutService.workouts$,
    this.exerciseService.exercises$
  ]).pipe(
    map(([workouts, exercises]) => {
      const now = new Date();
      const startOfWeek = this.getStartOfWeek(now);

      const workoutsThisWeek = workouts.filter((workout) => workout.date >= startOfWeek).length;
      const totalVolume = workouts.reduce((sum, workout) => sum + (workout.totalVolume ?? 0), 0);
      const averageVolume = workouts.length ? totalVolume / workouts.length : 0;

      const performanceMap = this.workoutService.buildPerformanceMap(workouts);
      const exerciseProgress = exercises.map((exercise) => {
        const performance = performanceMap.get(exercise.id);
        return {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          lastWeight: performance?.lastWeight,
          bestWeight: performance?.bestWeight,
          lastDate: performance?.lastDate
        };
      });

      return {
        totalWorkouts: workouts.length,
        workoutsThisWeek,
        averageVolume,
        exerciseProgress
      };
    })
  );

  private getStartOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay();
    const diff = result.getDate() - day + (day === 0 ? -6 : 1);
    result.setDate(diff);
    result.setHours(0, 0, 0, 0);
    return result;
  }
}
