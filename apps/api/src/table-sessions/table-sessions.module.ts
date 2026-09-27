import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TABLE_SESSION_REPOSITORY } from './domain/table-session.repository.interface';
import { PrismaTableSessionsRepository } from './infrastructure/prisma-table-sessions.repository';
import { TableSessionsService } from './application/table-sessions.service';
import { TableSessionsController } from './presentation/table-sessions.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TableSessionsController],
  providers: [
    TableSessionsService,
    {
      provide: TABLE_SESSION_REPOSITORY,
      useClass: PrismaTableSessionsRepository,
    },
  ],
  exports: [TableSessionsService],
})
export class TableSessionsModule {}
