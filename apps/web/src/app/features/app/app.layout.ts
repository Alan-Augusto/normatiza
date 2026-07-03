import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './app.layout.html',
  styleUrl: './app.layout.css'
})
export class AppLayoutComponent {}
