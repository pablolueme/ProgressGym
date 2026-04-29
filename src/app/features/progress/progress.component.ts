import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { map, startWith, switchMap } from 'rxjs';
import { ProgressService } from '../../core/services/progress.service';
import { WorkoutTimeRange } from '../../core/services/workout.service';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss'
})
export class ProgressComponent {
  private readonly progressService = inject(ProgressService);

  protected readonly rangeControl = new FormControl<WorkoutTimeRange>('2W', {
    nonNullable: true
  });

  protected readonly vm$ = this.rangeControl.valueChanges.pipe(
    startWith(this.rangeControl.value),
    switchMap((range) => this.progressService.getOverview$(range)),
    map((overview) => {
      const withData = overview.exerciseProgress
        .filter((item) => item.lastWeight != null || item.bestWeight != null || item.lastDate != null)
        .map((item) => {
          const lastWeight = item.lastWeight ?? 0;
          const bestWeight = item.bestWeight ?? 0;
          const progressRatio = bestWeight > 0 ? Math.min(100, Math.round((lastWeight / bestWeight) * 100)) : 0;

          let trend: 'up' | 'flat' | 'down' = 'flat';
          if (item.lastWeight != null && item.bestWeight != null) {
            if (item.lastWeight >= item.bestWeight) {
              trend = 'up';
            } else if (item.bestWeight - item.lastWeight > 2) {
              trend = 'down';
            }
          }

          return {
            ...item,
            progressRatio,
            trend
          };
        });

      const withoutData = overview.exerciseProgress.filter(
        (item) => item.lastWeight == null && item.bestWeight == null && item.lastDate == null
      );

      return {
        selectedRange: this.rangeControl.value,
        overview,
        withData,
        withoutData
      };
    })
  );
}
