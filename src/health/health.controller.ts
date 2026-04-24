import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

/**
 * Simple health‑check endpoint used by CI/CD pipelines and Kubernetes probes.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Health check – returns status ok' })
  health() {
    return { status: 'ok' };
  }
}
