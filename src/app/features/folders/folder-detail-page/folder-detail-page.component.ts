import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, map, switchMap } from 'rxjs';
import { Routine } from '../../../core/models';
import { FolderService } from '../../../core/services/folder.service';
import { RoutineService } from '../../../core/services/routine.service';

@Component({
  selector: 'app-folder-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './folder-detail-page.component.html',
  styleUrl: './folder-detail-page.component.scss'
})
export class FolderDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly folderService = inject(FolderService);
  private readonly routineService = inject(RoutineService);

  protected readonly folderId =
    this.route.snapshot.paramMap.get('folderId')?.trim() || '';
  protected editingRoutineId: string | null = null;
  protected message = '';
  protected isError = false;

  protected readonly folder$ = this.folderService.folderById$(this.folderId);
  protected readonly routines$ = this.routineService.routinesByFolder$(this.folderId);
  protected readonly vm$ = combineLatest([this.folder$, this.routines$]).pipe(
    map(([folder, routines]) => ({ folder, routines }))
  );

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    day: [''],
    notes: ['']
  });

  protected async submitRoutine(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = {
      folderId: this.folderId,
      ...this.form.getRawValue()
    };

    try {
      if (this.editingRoutineId) {
        await this.routineService.updateRoutine(this.editingRoutineId, payload);
        this.setMessage('Rutina actualizada.');
      } else {
        await this.routineService.createRoutine(payload);
        this.setMessage('Rutina creada.');
      }
      this.resetRoutineForm();
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  protected editRoutine(routine: Routine): void {
    this.editingRoutineId = routine.id;
    this.form.patchValue({
      name: routine.name,
      description: routine.description ?? '',
      day: routine.day ?? '',
      notes: routine.notes ?? ''
    });
  }

  protected async deleteRoutine(routine: Routine): Promise<void> {
    const confirmDelete = window.confirm(`Quieres eliminar la rutina "${routine.name}"?`);
    if (!confirmDelete) {
      return;
    }
    try {
      await this.routineService.deleteRoutine(routine.id);
      this.setMessage('Rutina eliminada.');
      if (this.editingRoutineId === routine.id) {
        this.resetRoutineForm();
      }
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  protected async deleteFolder(folderName: string): Promise<void> {
    const confirmDelete = window.confirm(
      `Quieres eliminar la carpeta "${folderName}"? Las rutinas no se borran automaticamente.`
    );
    if (!confirmDelete) {
      return;
    }
    try {
      await this.folderService.deleteFolder(this.folderId);
      this.setMessage('Carpeta eliminada. Vuelve a la lista de carpetas.', false);
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  protected cancelEdition(): void {
    this.resetRoutineForm();
  }

  private resetRoutineForm(): void {
    this.editingRoutineId = null;
    this.form.reset({
      name: '',
      description: '',
      day: '',
      notes: ''
    });
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
