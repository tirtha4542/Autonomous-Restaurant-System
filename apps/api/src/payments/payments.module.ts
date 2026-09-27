import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboxModule } from '../outbox/outbox.module';
import { PaymentsService } from './application/payments.service';
import { PaymentsController } from './presentation/payments.controller';

@Module({
  imports: [PrismaModule, OutboxModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
