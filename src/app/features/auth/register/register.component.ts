import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { StarterDataService } from '../../../core/services/starter-data.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly starterDataService = inject(StarterDataService);
  private readonly router = inject(Router);

  protected isSubmitting = false;
  protected message = '';
  protected isError = false;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6)]],
    seedData: [true]
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
      this.setMessage('Las contrasenas no coinciden.', true);
      return;
    }

    this.isSubmitting = true;
    this.setMessage('');
    try {
      const user = await this.authService.register({
        name: this.form.controls.name.value,
        email: this.form.controls.email.value,
        password: this.form.controls.password.value
      });
      if (this.form.controls.seedData.value) {
        await this.starterDataService.seedForUser(user.uid);
      }
      await this.router.navigateByUrl('/app/home');
    } catch (error) {
      this.setMessage((error as Error).message, true);
    } finally {
      this.isSubmitting = false;
    }
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
