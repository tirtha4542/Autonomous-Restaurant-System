import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { KITCHEN_REPOSITORY } from './domain/kitchen.repository.interface';
import { PrismaKitchenRepository } from './infrastructure/prisma-kitchen.repository';
import { KitchenService } from './application/kitchen.service';
import { KitchenController } from './presentation/kitchen.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [KitchenController],
  providers: [
    KitchenService,
    {
      provide: KITCHEN_REPOSITORY,
      useClass: PrismaKitchenRepository,
    },
  ],
  exports: [KitchenService],
})
export class KitchenModule {}
