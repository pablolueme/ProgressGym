import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected isSubmitting = false;
  protected message = '';
  protected isError = false;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.isSubmitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.setMessage('');
    this.isSubmitting = true;
    try {
      await this.authService.login(this.form.controls.email.value, this.form.controls.password.value);
      await this.router.navigateByUrl('/app/home');
    } catch (error) {
      this.setMessage((error as Error).message, true);
    } finally {
      this.isSubmitting = false;
    }
  }

  protected async requestResetPassword(): Promise<void> {
    const email = this.form.controls.email.value;
    if (!email) {
      this.setMessage('Introduce tu email para recuperar la contrasena.', true);
      return;
    }
    try {
      await this.authService.sendPasswordReset(email);
      this.setMessage('Te hemos enviado un email para recuperar la contrasena.');
    } catch (error) {
      this.setMessage((error as Error).message, true);
    }
  }

  private setMessage(message: string, isError = false): void {
    this.message = message;
    this.isError = isError;
  }
}
