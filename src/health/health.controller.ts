import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/public.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (err) {
      throw new HttpException(
        { status: 'error', database: 'unreachable', message: err instanceof Error ? err.message : 'Unknown error' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return { status: 'ok', database: 'ok', timestamp: new Date().toISOString() };
  }
}
