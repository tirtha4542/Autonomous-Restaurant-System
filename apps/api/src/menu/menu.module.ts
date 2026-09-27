import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MENU_REPOSITORY } from './domain/menu.repository.interface';
import { PrismaMenuRepository } from './infrastructure/prisma-menu.repository';
import { MenuService } from './application/menu.service';
import { MenuController } from './presentation/menu.controller';

@Module({
  imports: [PrismaModule],
  controllers: [MenuController],
  providers: [
    MenuService,
    {
      provide: MENU_REPOSITORY,
      useClass: PrismaMenuRepository,
    },
  ],
  exports: [MenuService],
})
export class MenuModule {}
