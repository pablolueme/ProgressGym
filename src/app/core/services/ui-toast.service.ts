import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type UiToastType = 'success' | 'error' | 'info';

export interface UiToast {
  id: number;
  message: string;
  type: UiToastType;
}

@Injectable({ providedIn: 'root' })
export class UiToastService {
  private readonly toastsSubject = new BehaviorSubject<UiToast[]>([]);
  private nextId = 1;

  readonly toasts$ = this.toastsSubject.asObservable();

  success(message: string, durationMs = 2800): void {
    this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs = 4200): void {
    this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs = 3000): void {
    this.show(message, 'info', durationMs);
  }

  dismiss(id: number): void {
    const next = this.toastsSubject.value.filter((toast) => toast.id !== id);
    this.toastsSubject.next(next);
  }

  private show(message: string, type: UiToastType, durationMs: number): void {
    const id = this.nextId++;
    this.toastsSubject.next([...this.toastsSubject.value, { id, message, type }]);
    window.setTimeout(() => this.dismiss(id), durationMs);
  }
}
