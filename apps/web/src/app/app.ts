import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ModalHostComponent } from './core/modal/modal-host.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ModalHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {}
