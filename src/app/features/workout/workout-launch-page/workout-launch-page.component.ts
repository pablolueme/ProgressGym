import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { FolderService } from '../../../core/services/folder.service';
import { RoutineService } from '../../../core/services/routine.service';

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

  protected readonly vm$ = combineLatest([
    this.routineService.routines$,
    this.folderService.folders$
  ]).pipe(
    map(([routines, folders]) => {
      const folderMap = new Map(folders.map((folder) => [folder.id, folder.name]));
      return routines.map((routine) => ({
        routine,
        folderName: folderMap.get(routine.folderId) ?? 'Sin carpeta'
      }));
    })
  );
}
