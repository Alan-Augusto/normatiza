import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './admin.layout.html',
  styleUrl: './admin.layout.css'
})
export class AdminLayoutComponent {}
