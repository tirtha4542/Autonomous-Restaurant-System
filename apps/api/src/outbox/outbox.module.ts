import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { OutboxService } from './application/outbox.service';

@Global()
@Module({
  imports: [PrismaModule, RealtimeModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
