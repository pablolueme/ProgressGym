import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'welcome'
  },
  {
    path: 'welcome',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/welcome/welcome.component').then((module) => module.WelcomeComponent)
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((module) => module.LoginComponent)
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register/register.component').then((module) => module.RegisterComponent)
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layout/app-layout/app-layout.component').then((module) => module.AppLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadComponent: () =>
          import('./features/dashboard/home.component').then((module) => module.HomeComponent)
      },
      {
        path: 'folders',
        loadComponent: () =>
          import('./features/folders/folders-page/folders-page.component').then(
            (module) => module.FoldersPageComponent
          )
      },
      {
        path: 'folders/:folderId',
        loadComponent: () =>
          import('./features/folders/folder-detail-page/folder-detail-page.component').then(
            (module) => module.FolderDetailPageComponent
          )
      },
      {
        path: 'routines/:routineId',
        loadComponent: () =>
          import('./features/routines/routine-detail-page/routine-detail-page.component').then(
            (module) => module.RoutineDetailPageComponent
          )
      },
      {
        path: 'exercises',
        loadComponent: () =>
          import('./features/exercises/exercises-page/exercises-page.component').then(
            (module) => module.ExercisesPageComponent
          )
      },
      {
        path: 'exercises/:exerciseId',
        loadComponent: () =>
          import('./features/exercises/exercise-detail-page/exercise-detail-page.component').then(
            (module) => module.ExerciseDetailPageComponent
          )
      },
      {
        path: 'workout',
        loadComponent: () =>
          import('./features/workout/workout-launch-page/workout-launch-page.component').then(
            (module) => module.WorkoutLaunchPageComponent
          )
      },
      {
        path: 'workout/start/:routineId',
        loadComponent: () =>
          import('./features/workout/workout-start-page/workout-start-page.component').then(
            (module) => module.WorkoutStartPageComponent
          )
      },
      {
        path: 'workout/continue/:workoutId',
        loadComponent: () =>
          import('./features/workout/workout-start-page/workout-start-page.component').then(
            (module) => module.WorkoutStartPageComponent
          )
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./features/history/history-page/history-page.component').then(
            (module) => module.HistoryPageComponent
          )
      },
      {
        path: 'history/:workoutId',
        loadComponent: () =>
          import('./features/history/history-detail-page/history-detail-page.component').then(
            (module) => module.HistoryDetailPageComponent
          )
      },
      {
        path: 'progress',
        loadComponent: () =>
          import('./features/progress/progress.component').then((module) => module.ProgressComponent)
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile.component').then((module) => module.ProfileComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: 'welcome'
  }
];
