import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuthAndRbacGuard } from './auth/infrastructure/guards/auth-and-rbac.guard';
import { InternalModule } from './internal/internal.module';
import { MenuModule } from './menu/menu.module';
import { TableSessionsModule } from './table-sessions/table-sessions.module';
import { OrdersModule } from './orders/orders.module';
import { KitchenModule } from './kitchen/kitchen.module';
import { RealtimeModule } from './realtime/realtime.module';
import { OutboxModule } from './outbox/outbox.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    InternalModule,
    RealtimeModule,
    OutboxModule,
    MenuModule,
    TableSessionsModule,
    OrdersModule,
    KitchenModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthAndRbacGuard,
    },
  ],
})
export class AppModule {}
