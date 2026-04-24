import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { GymFolder, Routine } from '../../../core/models';
import { FolderService } from '../../../core/services/folder.service';
import { RoutineService } from '../../../core/services/routine.service';
import { UiToastService } from '../../../core/services/ui-toast.service';

type FolderDetailStatus = 'loading' | 'ready' | 'not-found' | 'invalid' | 'error';

interface FolderDetailViewModel {
  status: FolderDetailStatus;
  folderId: string;
  folder: GymFolder | null;
  routines: Routine[];
  errorMessage: string;
}

@Component({
  selector: 'app-folder-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './folder-detail-page.component.html',
  styleUrl: './folder-detail-page.component.scss'
})
export class FolderDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly folderService = inject(FolderService);
  private readonly routineService = inject(RoutineService);
  private readonly toast = inject(UiToastService);

  private readonly routeFolderId$ = this.route.paramMap.pipe(
    map((params) => params.get('folderId')?.trim() ?? ''),
    distinctUntilChanged()
  );

  protected editingRoutineId: string | null = null;
  protected isSubmitting = false;
  protected isRoutineFormOpen = false;
  protected currentFolderId = '';

  protected readonly vm$ = this.routeFolderId$.pipe(
    switchMap((folderId) => {
      this.currentFolderId = folderId;
      if (!folderId) {
        return of<FolderDetailViewModel>({
          status: 'invalid',
          folderId: '',
          folder: null,
          routines: [],
          errorMessage: 'No se ha recibido un identificador de carpeta valido.'
        });
      }

      return combineLatest([
        this.folderService.getFolderById(folderId),
        this.routineService.getRoutinesByFolderId(folderId)
      ]).pipe(
        map(([folder, routines]) => {
          if (!folder) {
            return {
              status: 'not-found',
              folderId,
              folder: null,
              routines: [],
              errorMessage: 'La carpeta no existe o ya no esta disponible.'
            } satisfies FolderDetailViewModel;
          }
          return {
            status: 'ready',
            folderId,
            folder,
            routines,
            errorMessage: ''
          } satisfies FolderDetailViewModel;
        }),
        startWith({
          status: 'loading',
          folderId,
          folder: null,
          routines: [],
          errorMessage: ''
        } satisfies FolderDetailViewModel),
        catchError((error) =>
          of<FolderDetailViewModel>({
            status: 'error',
            folderId,
            folder: null,
            routines: [],
            errorMessage: this.getErrorMessage(error, 'No se pudo cargar la carpeta.')
          })
        )
      );
    })
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    day: [''],
    notes: ['']
  });

  constructor() {
    this.routeFolderId$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.resetRoutineForm();
    });
  }

  protected openCreateRoutineForm(): void {
    this.editingRoutineId = null;
    this.form.reset({
      name: '',
      description: '',
      day: '',
      notes: ''
    });
    this.isRoutineFormOpen = true;
  }

  protected startEditRoutine(routine: Routine): void {
    this.editingRoutineId = routine.id;
    this.form.patchValue({
      name: routine.name,
      description: routine.description ?? '',
      day: routine.day ?? '',
      notes: routine.notes ?? ''
    });
    this.isRoutineFormOpen = true;
  }

  protected cancelRoutineForm(): void {
    this.resetRoutineForm();
  }

  protected async submitRoutine(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.currentFolderId) {
      this.toast.error('No se puede crear la rutina porque falta la carpeta.');
      return;
    }

    this.isSubmitting = true;
    const formValue = this.form.getRawValue();
    try {
      if (this.editingRoutineId) {
        await this.routineService.updateRoutine(this.editingRoutineId, {
          folderId: this.currentFolderId,
          ...formValue
        });
        this.toast.success('Rutina actualizada.');
      } else {
        await this.routineService.createRoutine(this.currentFolderId, formValue);
        this.toast.success('Rutina creada.');
      }
      this.resetRoutineForm();
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo guardar la rutina.'));
    } finally {
      this.isSubmitting = false;
    }
  }

  protected async deleteRoutine(routine: Routine): Promise<void> {
    const confirmDelete = window.confirm(`Quieres eliminar la rutina "${routine.name}"?`);
    if (!confirmDelete) {
      return;
    }
    try {
      await this.routineService.deleteRoutine(routine.id);
      this.toast.success('Rutina eliminada.');
      if (this.editingRoutineId === routine.id) {
        this.resetRoutineForm();
      }
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar la rutina.'));
    }
  }

  protected async deleteFolder(folderName: string): Promise<void> {
    const confirmDelete = window.confirm(
      `Quieres eliminar la carpeta "${folderName}"? Las rutinas no se borran automaticamente.`
    );
    if (!confirmDelete || !this.currentFolderId) {
      return;
    }
    try {
      await this.folderService.deleteFolder(this.currentFolderId);
      this.toast.success('Carpeta eliminada.');
      await this.router.navigateByUrl('/app/folders');
    } catch (error) {
      this.toast.error(this.getErrorMessage(error, 'No se pudo eliminar la carpeta.'));
    }
  }

  private resetRoutineForm(): void {
    this.editingRoutineId = null;
    this.isRoutineFormOpen = false;
    this.form.reset({
      name: '',
      description: '',
      day: '',
      notes: ''
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  }
}
