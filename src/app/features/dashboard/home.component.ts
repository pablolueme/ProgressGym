import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { ProgressService } from '../../core/services/progress.service';
import { UserProfileService } from '../../core/services/user-profile.service';
import { WorkoutService } from '../../core/services/workout.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private readonly userProfileService = inject(UserProfileService);
  private readonly progressService = inject(ProgressService);
  private readonly workoutService = inject(WorkoutService);

  protected readonly vm$ = combineLatest([
    this.userProfileService.profile$,
    this.progressService.overview$,
    this.workoutService.workouts$
  ]).pipe(
    map(([profile, overview, workouts]) => ({
      profile,
      overview,
      lastWorkout: workouts[0] ?? null,
      recentExercises:
        workouts[0]?.entries
          .slice(0, 4)
          .map((entry) => entry.exerciseName)
          .filter(Boolean) ?? []
    }))
  );
}
