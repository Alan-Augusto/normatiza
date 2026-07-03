import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { SharedHello } from '@normatiza/shared';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): SharedHello {
    return this.appService.getHello();
  }
}
