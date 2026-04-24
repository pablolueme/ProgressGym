import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { GymFolder } from '../../../core/models';
import { FolderService } from '../../../core/services/folder.service';

@Component({
  selector: 'app-folders-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './folders-page.component.html',
  styleUrl: './folders-page.component.scss'
})
export class FoldersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly folderService = inject(FolderService);

  protected readonly folders$ = this.folderService.folders$;
  protected editingFolderId: string | null = null;
  protected isSubmitting = false;
  protected message = '';
  protected isError = false;

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
    this.setMessage('');
    try {
      if (this.editingFolderId) {
        await this.folderService.updateFolder(this.editingFolderId, this.form.getRawValue());
        this.setMessage('Carpeta actualizada.');
      } else {
        await this.folderService.createFolder(this.form.getRawValue());
        this.setMessage('Carpeta creada.');
      }
      this.resetForm();
    } catch (error) {
      this.setMessage((error as Error).message, true);
    } finally {
      this.isSubmitting = false;
    }
  }

  protected startEdit(folder: GymFolder): void {
    this.editingFolderId = folder.id;
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
      this.setMessage('Carpeta eliminada.');
      if (this.editingFolderId === folder.id) {
        this.resetForm();
      }
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.editingFolderId = null;
    this.form.reset({
      name: '',
      description: '',
      color: '',
      icon: ''
    });
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
