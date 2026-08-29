import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { HealthModule } from './health/health.module';
import { GroupsModule } from './groups/groups.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      // Hosted Postgres providers that require an encrypted connection
      // (Neon, Render's own Postgres, etc.) reject a plain connection
      // outright — but a local dev Postgres on localhost typically has no
      // SSL listener at all, so this can't just be on unconditionally.
      // rejectUnauthorized: false accepts the provider's own cert without
      // pinning a CA bundle, which is fine for this stage but worth
      // tightening (a real CA bundle) before this ever holds production
      // tenant data.
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      autoLoadEntities: true,
      synchronize: false,
      migrations: [join(__dirname, 'migrations', '*.js')],
      migrationsRun: true,
    }),

    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),

    HealthModule,
    AuthModule,
    GroupsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
