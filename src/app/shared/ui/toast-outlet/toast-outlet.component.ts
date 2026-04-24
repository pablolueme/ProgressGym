import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { UiToast, UiToastService } from '../../../core/services/ui-toast.service';

@Component({
  selector: 'app-toast-outlet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-outlet.component.html',
  styleUrl: './toast-outlet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ToastOutletComponent {
  private readonly toastService = inject(UiToastService);
  protected readonly toasts$ = this.toastService.toasts$;

  protected dismiss(id: number): void {
    this.toastService.dismiss(id);
  }

  protected iconFor(toast: UiToast): string {
    switch (toast.type) {
      case 'success':
        return 'check_circle';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  }
}
