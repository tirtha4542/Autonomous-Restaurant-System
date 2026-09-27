import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IMenuRepository } from '../domain/menu.repository.interface';
import { MenuItem } from '../domain/menu-item.entity';

@Injectable()
export class PrismaMenuRepository implements IMenuRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByBranch(branchId: number): Promise<MenuItem[]> {
    const records = await this.prisma.menu_items.findMany({
      where: { branch_id: branchId },
      orderBy: { id: 'asc' },
    });

    return records.map(
      (r) =>
        new MenuItem({
          id: r.id,
          branchId: r.branch_id,
          name: r.name,
          description: r.description,
          price: Number(r.price),
          station: r.station,
          allergens: Array.isArray(r.allergens) ? (r.allergens as string[]) : [],
          imageUrl: r.image_url,
          image_url: r.image_url,
        }),
    );
  }

  async findById(id: number, branchId: number): Promise<MenuItem | null> {
    const r = await this.prisma.menu_items.findFirst({
      where: { id, branch_id: branchId },
    });

    if (!r) return null;

    return new MenuItem({
      id: r.id,
      branchId: r.branch_id,
      name: r.name,
      description: r.description,
      price: Number(r.price),
      station: r.station,
      allergens: Array.isArray(r.allergens) ? (r.allergens as string[]) : [],
      imageUrl: r.image_url,
      image_url: r.image_url,
    });
  }
}
