import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { map } from 'rxjs';
import { ProgressService } from '../../core/services/progress.service';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss'
})
export class ProgressComponent {
  private readonly progressService = inject(ProgressService);

  protected readonly vm$ = this.progressService.overview$.pipe(
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
        overview,
        withData,
        withoutData
      };
    })
  );
}
