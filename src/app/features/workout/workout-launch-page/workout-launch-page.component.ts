import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith } from 'rxjs';
import { FolderService } from '../../../core/services/folder.service';
import { RoutineService } from '../../../core/services/routine.service';
import { WorkoutService } from '../../../core/services/workout.service';

type WorkoutLaunchStatus = 'loading' | 'ready' | 'error';

interface WorkoutLaunchRoutineCard {
  routineId: string;
  routineName: string;
  routineDescription: string;
  folderName: string;
  exerciseCount: number;
  lastWorkoutDate: Date | null;
}

interface WorkoutLaunchViewModel {
  status: WorkoutLaunchStatus;
  routines: WorkoutLaunchRoutineCard[];
  errorMessage: string;
}

@Component({
  selector: 'app-workout-launch-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './workout-launch-page.component.html',
  styleUrl: './workout-launch-page.component.scss'
})
export class WorkoutLaunchPageComponent {
  private readonly routineService = inject(RoutineService);
  private readonly folderService = inject(FolderService);
  private readonly workoutService = inject(WorkoutService);

  protected readonly vm$ = combineLatest([
    this.routineService.routines$,
    this.folderService.folders$,
    this.workoutService.workouts$
  ]).pipe(
    map(([routines, folders, workouts]) => {
      const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
      const lastWorkoutByRoutine = new Map<string, Date>();

      workouts.forEach((workout) => {
        if (!lastWorkoutByRoutine.has(workout.routineId)) {
          lastWorkoutByRoutine.set(workout.routineId, workout.date);
        }
      });

      return {
        status: 'ready',
        routines: routines.map((routine) => ({
          routineId: routine.id,
          routineName: routine.name,
          routineDescription: routine.description || '',
          folderName: folderMap.get(routine.folderId) ?? 'Sin carpeta',
          exerciseCount: routine.exercises.length,
          lastWorkoutDate: lastWorkoutByRoutine.get(routine.id) ?? null
        })),
        errorMessage: ''
      } satisfies WorkoutLaunchViewModel;
    }),
    startWith({
      status: 'loading',
      routines: [],
      errorMessage: ''
    } satisfies WorkoutLaunchViewModel),
    catchError((error) =>
      of<WorkoutLaunchViewModel>({
        status: 'error',
        routines: [],
        errorMessage:
          error instanceof Error && error.message
            ? error.message
            : 'No se pudieron cargar las rutinas.'
      })
    )
  );
}
