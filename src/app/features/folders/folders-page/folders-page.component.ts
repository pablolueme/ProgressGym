import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, startWith } from 'rxjs';
import { GymFolder } from '../../../core/models';
import { FolderService } from '../../../core/services/folder.service';
import { RoutineService } from '../../../core/services/routine.service';
import { UiToastService } from '../../../core/services/ui-toast.service';

type FoldersStatus = 'loading' | 'ready' | 'error';

interface FolderCardViewModel extends GymFolder {
  routinesCount: number;
  accentColor: string;
}

interface FoldersViewModel {
  status: FoldersStatus;
  folders: FolderCardViewModel[];
  errorMessage: string;
}

@Component({
  selector: 'app-folders-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './folders-page.component.html',
  styleUrl: './folders-page.component.scss'
})
export class FoldersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly folderService = inject(FolderService);
  private readonly routineService = inject(RoutineService);
  private readonly toast = inject(UiToastService);

  protected readonly vm$ = combineLatest([
    this.folderService.folders$,
    this.routineService.routines$
  ]).pipe(
    map(([folders, routines]) => {
      const routinesPerFolder = new Map<string, number>();
      routines.forEach((routine) => {
        routinesPerFolder.set(routine.folderId, (routinesPerFolder.get(routine.folderId) ?? 0) + 1);
      });

      const folderCards: FolderCardViewModel[] = folders.map((folder) => ({
        ...folder,
        routinesCount: routinesPerFolder.get(folder.id) ?? 0,
        icon: folder.icon || 'folder',
        accentColor: folder.color || '#22c55e'
      }));

      return {
        status: 'ready',
        folders: folderCards,
        errorMessage: ''
      } satisfies FoldersViewModel;
    }),
    startWith({
      status: 'loading',
      folders: [],
      errorMessage: ''
    } satisfies FoldersViewModel),
    catchError((error) =>
      of<FoldersViewModel>({
        status: 'error',
        folders: [],
        errorMessage:
          error instanceof Error && error.message
            ? error.message
            : 'No se pudieron cargar las carpetas.'
      })
    )
  );

  protected editingFolderId: string | null = null;
  protected isSubmitting = false;
  protected isFormOpen = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    color: [''],
    icon: ['']
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting = true;
    try {
      if (this.editingFolderId) {
        await this.folderService.updateFolder(this.editingFolderId, this.form.getRawValue());
        this.toast.success('Carpeta actualizada.');
      } else {
        await this.folderService.createFolder(this.form.getRawValue());
        this.toast.success('Carpeta creada.');
      }
      this.resetForm();
    } catch (error) {
      this.toast.error((error as Error).message);
    } finally {
      this.isSubmitting = false;
    }
  }

  protected openCreateForm(): void {
    if (this.editingFolderId) {
      this.cancelEdit();
      return;
    }
    this.isFormOpen = true;
  }

  protected startEdit(folder: GymFolder): void {
    this.editingFolderId = folder.id;
    this.isFormOpen = true;
    this.form.patchValue({
      name: folder.name,
      description: folder.description ?? '',
      color: folder.color ?? '',
      icon: folder.icon ?? ''
    });
  }

  protected async remove(folder: GymFolder): Promise<void> {
    const confirmDelete = window.confirm(`Quieres eliminar la carpeta "${folder.name}"?`);
    if (!confirmDelete) {
      return;
    }
    try {
      await this.folderService.deleteFolder(folder.id);
      this.toast.success('Carpeta eliminada.');
      if (this.editingFolderId === folder.id) {
        this.resetForm();
      }
    } catch (error) {
      this.toast.error((error as Error).message);
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected async goToFolder(folderId: string): Promise<void> {
    await this.router.navigate(['/app/folders', folderId]);
  }

  private resetForm(): void {
    this.editingFolderId = null;
    this.isFormOpen = false;
    this.form.reset({
      name: '',
      description: '',
      color: '',
      icon: ''
    });
  }
}
