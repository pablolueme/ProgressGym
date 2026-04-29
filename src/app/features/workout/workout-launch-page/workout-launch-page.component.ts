import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  inProgressWorkoutId: string | null;
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
  private readonly router = inject(Router);

  protected readonly vm$ = combineLatest([
    this.routineService.routines$,
    this.folderService.folders$,
    this.workoutService.workouts$
  ]).pipe(
    map(([routines, folders, workouts]) => {
      const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
      const lastWorkoutByRoutine = new Map<string, Date>();
      const inProgressByRoutine = new Map<string, string>();

      workouts.forEach((workout) => {
        if (!lastWorkoutByRoutine.has(workout.routineId) && workout.status === 'COMPLETED') {
          lastWorkoutByRoutine.set(workout.routineId, workout.date);
        }
        if (workout.status === 'IN_PROGRESS' && !inProgressByRoutine.has(workout.routineId)) {
          inProgressByRoutine.set(workout.routineId, workout.id);
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
          lastWorkoutDate: lastWorkoutByRoutine.get(routine.id) ?? null,
          inProgressWorkoutId: inProgressByRoutine.get(routine.id) ?? null
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

  protected async startOrContinueWorkout(item: WorkoutLaunchRoutineCard): Promise<void> {
    if (item.inProgressWorkoutId) {
      const continueExisting = window.confirm(
        'Ya tienes un entrenamiento en curso para esta rutina.\n\nAceptar: Continuar entrenamiento\nCancelar: Empezar nuevo entrenamiento'
      );
      if (continueExisting) {
        await this.router.navigate(['/app/workout/continue', item.inProgressWorkoutId]);
        return;
      }
      await this.router.navigate(['/app/workout/start', item.routineId], {
        queryParams: { mode: 'new' }
      });
      return;
    }

    await this.router.navigate(['/app/workout/start', item.routineId]);
  }

  protected async continueWorkout(workoutId: string | null): Promise<void> {
    if (!workoutId) {
      return;
    }
    await this.router.navigate(['/app/workout/continue', workoutId]);
  }

  protected async startNewWorkout(routineId: string): Promise<void> {
    await this.router.navigate(['/app/workout/start', routineId], {
      queryParams: { mode: 'new' }
    });
  }
}
