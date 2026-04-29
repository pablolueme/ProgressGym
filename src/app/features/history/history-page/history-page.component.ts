import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { combineLatest, map, startWith, switchMap } from 'rxjs';
import { UiToastService } from '../../../core/services/ui-toast.service';
import { WorkoutService } from '../../../core/services/workout.service';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './history-page.component.html',
  styleUrl: './history-page.component.scss'
})
export class HistoryPageComponent {
  private static readonly CLEANUP_STORAGE_KEY = 'gymtrack_last_history_cleanup';

  private readonly workoutService = inject(WorkoutService);
  private readonly toast = inject(UiToastService);

  protected readonly rangeControl = new FormControl<'2W' | '1M' | 'ALL'>('2W', {
    nonNullable: true
  });

  protected readonly completedWorkouts$ = this.rangeControl.valueChanges.pipe(
    startWith(this.rangeControl.value),
    switchMap((range) => this.workoutService.getCompletedWorkouts({ range }))
  );

  protected readonly vm$ = combineLatest([
    this.completedWorkouts$,
    this.workoutService.getInProgressWorkouts()
  ]).pipe(map(([completedWorkouts, inProgressWorkouts]) => ({ completedWorkouts, inProgressWorkouts })));

  constructor() {
    void this.runDailyHistoryCleanup();
  }

  private async runDailyHistoryCleanup(): Promise<void> {
    const todayKey = this.getTodayKey();
    const lastCleanupKey = this.readCleanupKey();

    if (lastCleanupKey === todayKey) {
      return;
    }

    try {
      const deletedCount = await this.workoutService.cleanupOldWorkoutHistory(14);
      if (deletedCount > 0) {
        this.toast.info(`Se han eliminado ${deletedCount} entrenamientos antiguos del historial.`);
      }
    } catch (error) {
      console.error('Error al ejecutar limpieza automatica del historial:', error);
    } finally {
      this.writeCleanupKey(todayKey);
    }
  }

  private readCleanupKey(): string {
    try {
      return localStorage.getItem(HistoryPageComponent.CLEANUP_STORAGE_KEY) ?? '';
    } catch (error) {
      console.error('No se pudo leer la marca de limpieza del historial:', error);
      return '';
    }
  }

  private writeCleanupKey(value: string): void {
    try {
      localStorage.setItem(HistoryPageComponent.CLEANUP_STORAGE_KEY, value);
    } catch (error) {
      console.error('No se pudo guardar la marca de limpieza del historial:', error);
    }
  }

  private getTodayKey(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
