import { Injectable } from '@nestjs/common';
import { getHelloMessage, SharedHello } from '@normatiza/shared';

@Injectable()
export class AppService {
  getHello(): SharedHello {
    return getHelloMessage('NestJS API');
  }
}
