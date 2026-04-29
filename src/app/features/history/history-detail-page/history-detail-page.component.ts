import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap, tap } from 'rxjs';
import { WorkoutService } from '../../../core/services/workout.service';

@Component({
  selector: 'app-history-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history-detail-page.component.html',
  styleUrl: './history-detail-page.component.scss'
})
export class HistoryDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workoutService = inject(WorkoutService);

  protected readonly vm$ = this.route.paramMap.pipe(
    map((params) => params.get('workoutId')?.trim() ?? ''),
    tap((workoutId) => {
      this.workoutId = workoutId;
    }),
    switchMap((workoutId) => {
      if (!workoutId) {
        return of({
          status: 'not-found' as const,
          workoutId: '',
          workout: null,
          errorMessage: 'No se pudo abrir el detalle del entrenamiento.'
        });
      }

      return this.workoutService.workoutById$(workoutId).pipe(
        map((workout) => {
          if (!workout) {
            return {
              status: 'not-found' as const,
              workoutId,
              workout: null,
              errorMessage: 'No se pudo abrir el detalle del entrenamiento.'
            };
          }
          return {
            status: 'ready' as const,
            workoutId,
            workout,
            errorMessage: ''
          };
        }),
        startWith({
          status: 'loading' as const,
          workoutId,
          workout: null,
          errorMessage: ''
        }),
        catchError((error) => {
          console.error(error);
          return of({
            status: 'error' as const,
            workoutId,
            workout: null,
            errorMessage: 'No se pudo abrir el detalle del entrenamiento.'
          });
        })
      );
    })
  );

  protected workoutId = '';
  protected message = '';
  protected isError = false;

  protected async deleteWorkout(): Promise<void> {
    const confirmed = window.confirm('Quieres eliminar este entrenamiento?');
    if (!confirmed) {
      return;
    }
    try {
      const routeWorkoutId = this.workoutId || (this.route.snapshot.paramMap.get('workoutId') ?? '');
      if (!routeWorkoutId) {
        this.message = 'No se pudo abrir el detalle del entrenamiento.';
        this.isError = true;
        return;
      }
      await this.workoutService.deleteWorkout(routeWorkoutId);
      await this.router.navigateByUrl('/app/history');
    } catch (error) {
      console.error(error);
      this.message = (error as Error).message;
      this.isError = true;
    }
  }

  protected async repeatWorkout(routineId: string): Promise<void> {
    if (!routineId) {
      this.message = 'No se puede repetir: rutina no disponible.';
      this.isError = true;
      return;
    }
    await this.router.navigate(['/app/workout/start', routineId]);
  }
}
