import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { InternalController } from './presentation/internal.controller';
import { InternalService } from './application/internal.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InternalController],
  providers: [InternalService],
  exports: [InternalService],
})
export class InternalModule {}
