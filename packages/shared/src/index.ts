export interface SharedHello {
  message: string;
  timestamp: Date;
}

export function getHelloMessage(name: string = 'World'): SharedHello {
  return {
    message: `Hello ${name} from @normatiza/shared!`,
    timestamp: new Date()
  };
}
