import { Component, OnInit } from '@angular/core';
import { getHelloMessage, SharedHello } from '@normatiza/shared';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  protected helloData!: SharedHello;

  ngOnInit() {
    this.helloData = getHelloMessage('Mobile App');
  }
}
