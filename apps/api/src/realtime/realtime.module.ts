import { Global, Module } from '@nestjs/common';
import { RealtimeService } from './application/realtime.service';
import { RealtimeController } from './presentation/realtime.controller';

@Global()
@Module({
  controllers: [RealtimeController],
  providers: [RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
