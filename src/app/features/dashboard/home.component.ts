import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { FolderService } from '../../core/services/folder.service';
import { ProgressService } from '../../core/services/progress.service';
import { RoutineService } from '../../core/services/routine.service';
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
  private readonly folderService = inject(FolderService);
  private readonly routineService = inject(RoutineService);

  protected readonly quickActions = [
    { icon: 'create_new_folder', label: 'Nueva carpeta', route: '/app/folders' },
    { icon: 'playlist_add', label: 'Nueva rutina', route: '/app/folders' },
    { icon: 'accessibility_new', label: 'Ejercicios', route: '/app/exercises' },
    { icon: 'fitness_center', label: 'Registrar entreno', route: '/app/workout' },
    { icon: 'monitoring', label: 'Ver progreso', route: '/app/progress' }
  ];

  protected readonly vm$ = combineLatest([
    this.userProfileService.profile$,
    this.progressService.overview$,
    this.workoutService.getCompletedWorkouts({ range: '2W' }),
    this.workoutService.getInProgressWorkouts(),
    this.folderService.folders$,
    this.routineService.routines$
  ]).pipe(
    map(([profile, overview, completedWorkouts, inProgressWorkouts, folders, routines]) => {
      const lastWorkout = completedWorkouts[0] ?? null;
      const activeWorkout = inProgressWorkouts[0] ?? null;
      const recentExercises =
        lastWorkout?.entries
          .slice(0, 5)
          .map((entry) => entry.exerciseName)
          .filter(Boolean) ?? [];

      const onboardingSteps = [
        {
          icon: 'folder',
          title: 'Crea una carpeta',
          description: 'Organiza tus rutinas por objetivo o grupo muscular.',
          route: '/app/folders',
          done: folders.length > 0
        },
        {
          icon: 'checklist',
          title: 'Monta tu primera rutina',
          description: 'Define ejercicios y series para entrenar sin friccion.',
          route: '/app/folders',
          done: routines.length > 0
        },
        {
          icon: 'bolt',
          title: 'Registra un entrenamiento',
          description: 'Empieza a construir historial para ver progreso real.',
          route: '/app/workout',
          done: completedWorkouts.length > 0
        }
      ];

      return {
        profile,
        overview,
        foldersCount: folders.length,
        routinesCount: routines.length,
        activeWorkout,
        lastWorkout,
        recentExercises,
        onboardingSteps,
        hasOnboardingPending: onboardingSteps.some((step) => !step.done)
      };
    })
  );
}
