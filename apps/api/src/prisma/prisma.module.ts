import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global so every domain module can inject PrismaService without each
 * one re-importing this module — keeps domain modules focused on their
 * own boundary (RULES.md #3: no global layer dumping, but a shared DB
 * connection is infrastructure, not business logic, so this is fine).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
