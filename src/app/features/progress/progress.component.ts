import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ProgressService } from '../../core/services/progress.service';

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress.component.html',
  styleUrl: './progress.component.scss'
})
export class ProgressComponent {
  private readonly progressService = inject(ProgressService);
  protected readonly overview$ = this.progressService.overview$;
}
