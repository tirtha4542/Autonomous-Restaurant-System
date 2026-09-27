import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ORDER_REPOSITORY } from './domain/order.repository.interface';
import { PrismaOrdersRepository } from './infrastructure/prisma-orders.repository';
import { OrdersService } from './application/orders.service';
import { OrdersController } from './presentation/orders.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    {
      provide: ORDER_REPOSITORY,
      useClass: PrismaOrdersRepository,
    },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
