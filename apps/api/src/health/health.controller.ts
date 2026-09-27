import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/infrastructure/decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  ok() {
    return { status: 'ok' };
  }

  /**
   * GET /health/db — runs a real query against your Postgres database.
   * If this returns { status: 'ok', db: 'connected' }, the connection
   * from apps/api to your existing local database is confirmed working.
   */
  @Get('db')
  async db() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'connected' };
    } catch (error) {
      throw new HttpException(
        { status: 'error', db: 'unreachable', detail: (error as Error).message },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
