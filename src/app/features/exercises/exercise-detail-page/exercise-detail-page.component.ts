import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { ExerciseService } from '../../../core/services/exercise.service';
import { WorkoutService } from '../../../core/services/workout.service';

@Component({
  selector: 'app-exercise-detail-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './exercise-detail-page.component.html',
  styleUrl: './exercise-detail-page.component.scss'
})
export class ExerciseDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly exerciseService = inject(ExerciseService);
  private readonly workoutService = inject(WorkoutService);

  protected readonly exerciseId = this.route.snapshot.paramMap.get('exerciseId') ?? '';
  protected readonly vm$ = combineLatest([
    this.exerciseService.exerciseById$(this.exerciseId),
    this.workoutService.getPerformanceByExercise$(this.exerciseId)
  ]).pipe(map(([exercise, performance]) => ({ exercise, performance })));
}
