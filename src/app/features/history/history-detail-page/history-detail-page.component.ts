import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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

  protected readonly workoutId = this.route.snapshot.paramMap.get('workoutId') ?? '';
  protected readonly workout$ = this.workoutService.workoutById$(this.workoutId);
  protected message = '';
  protected isError = false;

  protected async deleteWorkout(): Promise<void> {
    const confirmed = window.confirm('Quieres eliminar este entrenamiento?');
    if (!confirmed) {
      return;
    }
    try {
      await this.workoutService.deleteWorkout(this.workoutId);
      await this.router.navigateByUrl('/app/history');
    } catch (error) {
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
