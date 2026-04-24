import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { UiToastService } from '../../core/services/ui-toast.service';
import { UserProfileService } from '../../core/services/user-profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly userProfileService = inject(UserProfileService);
  private readonly toast = inject(UiToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly goals = [
    'Volumen',
    'Definicion',
    'Recomposicion corporal',
    'Fuerza',
    'Salud',
    'Otro'
  ];
  protected readonly experienceLevels = ['Principiante', 'Intermedio', 'Avanzado'];

  protected readonly profile$ = this.userProfileService.profile$;
  protected readonly summary$ = this.profile$.pipe(
    map((profile) => ({
      name: profile?.name || 'Atleta',
      goal: profile?.goal || 'Objetivo pendiente',
      level: profile?.experienceLevel || 'Sin nivel',
      trainingDaysPerWeek: profile?.trainingDaysPerWeek ?? 0
    }))
  );
  protected isSubmitting = false;
  private currentEmail = '';

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    weight: [0],
    height: [0],
    goal: ['Otro'],
    experienceLevel: ['Principiante'],
    trainingDaysPerWeek: [3]
  });

  constructor() {
    this.profile$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((profile) => {
      if (!profile) {
        return;
      }
      this.form.patchValue({
        name: profile.name ?? '',
        email: profile.email ?? '',
        weight: profile.weight ?? 0,
        height: profile.height ?? 0,
        goal: profile.goal ?? 'Otro',
        experienceLevel: profile.experienceLevel ?? 'Principiante',
        trainingDaysPerWeek: profile.trainingDaysPerWeek ?? 3
      });
      this.currentEmail = profile.email ?? '';
    });
  }

  protected async saveProfile(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    try {
      const raw = this.form.getRawValue();
      if (raw.email !== this.currentEmail) {
        await this.authService.updateCurrentUserEmail(raw.email);
        this.currentEmail = raw.email;
      }
      await this.userProfileService.updateProfile({
        name: raw.name,
        email: raw.email,
        weight: raw.weight || undefined,
        height: raw.height || undefined,
        goal: raw.goal as
          | 'Volumen'
          | 'Definicion'
          | 'Recomposicion corporal'
          | 'Fuerza'
          | 'Salud'
          | 'Otro',
        experienceLevel: raw.experienceLevel as 'Principiante' | 'Intermedio' | 'Avanzado',
        trainingDaysPerWeek: raw.trainingDaysPerWeek || undefined
      });
      this.toast.success('Perfil actualizado.');
    } catch (error) {
      this.toast.error((error as Error).message);
    } finally {
      this.isSubmitting = false;
    }
  }

  protected async logout(): Promise<void> {
    await this.authService.logout();
  }

  protected async deleteData(): Promise<void> {
    const confirmed = window.confirm('Quieres borrar todos tus datos? Esta accion no se puede deshacer.');
    if (!confirmed) {
      return;
    }
    try {
      await this.userProfileService.deleteAllUserData();
      this.toast.info('Datos de usuario eliminados.');
    } catch (error) {
      this.toast.error((error as Error).message);
    }
  }

  protected async deleteAccount(): Promise<void> {
    const confirmed = window.confirm(
      'Quieres borrar tu cuenta? Se eliminaran perfil, carpetas, ejercicios, rutinas y entrenamientos.'
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.userProfileService.deleteAllUserData();
      await this.authService.deleteCurrentAccount();
      this.toast.info('Cuenta eliminada.');
    } catch (error) {
      this.toast.error((error as Error).message);
    }
  }
}
