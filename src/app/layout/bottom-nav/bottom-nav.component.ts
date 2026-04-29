import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.component.html',
  styleUrl: './bottom-nav.component.scss'
})
export class BottomNavComponent {
  protected readonly items = [
    { label: 'Inicio', icon: 'home', route: '/app/home' },
    { label: 'Carpetas', icon: 'folder', route: '/app/folders' },
    { label: 'Registrar', icon: 'edit_note', route: '/app/workout' },
    { label: 'Historial', icon: 'history', route: '/app/history' },
    { label: 'Progreso', icon: 'timeline', route: '/app/progress' },
    { label: 'Perfil', icon: 'person', route: '/app/profile' }
  ];
}
