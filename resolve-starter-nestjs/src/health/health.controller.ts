import { Controller, Get } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { name, version } = require('../../package.json');

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      name,
      version,
      uptime: process.uptime(),
    };
  }
}
