import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BottomNavComponent } from '../bottom-nav/bottom-nav.component';

@Component({
  selector: 'app-app-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, BottomNavComponent],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss'
})
export class AppLayoutComponent {
  protected readonly navItems = [
    { icon: 'home', label: 'Inicio', route: '/app/home' },
    { icon: 'folder', label: 'Carpetas', route: '/app/folders' },
    { icon: 'edit_note', label: 'Registrar', route: '/app/workout' },
    { icon: 'history', label: 'Historial', route: '/app/history' },
    { icon: 'timeline', label: 'Progreso', route: '/app/progress' },
    { icon: 'person', label: 'Perfil', route: '/app/profile' }
  ];
}
