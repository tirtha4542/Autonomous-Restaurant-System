import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ITableSessionRepository } from '../domain/table-session.repository.interface';
import { TableSession } from '../domain/table-session.entity';

@Injectable()
export class PrismaTableSessionsRepository implements ITableSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByTable(tableId: number, branchId: number): Promise<TableSession | null> {
    const record = await this.prisma.table_sessions.findFirst({
      where: {
        table_id: tableId,
        branch_id: branchId,
        closed_at: null,
      },
      include: {
        dining_tables: true,
      },
    });

    if (!record) return null;

    return new TableSession({
      id: record.id,
      tableId: record.table_id,
      branchId: record.branch_id,
      status: record.status,
      openedAt: record.opened_at,
      closedAt: record.closed_at,
      tableCode: record.dining_tables?.code,
      capacity: record.dining_tables?.capacity,
    });
  }

  async findById(id: number): Promise<TableSession | null> {
    const record = await this.prisma.table_sessions.findUnique({
      where: { id },
      include: {
        dining_tables: true,
      },
    });

    if (!record) return null;

    return new TableSession({
      id: record.id,
      tableId: record.table_id,
      branchId: record.branch_id,
      status: record.status,
      openedAt: record.opened_at,
      closedAt: record.closed_at,
      tableCode: record.dining_tables?.code,
      capacity: record.dining_tables?.capacity,
    });
  }

  async findActiveByBranch(branchId: number): Promise<TableSession[]> {
    const records = await this.prisma.table_sessions.findMany({
      where: {
        branch_id: branchId,
        closed_at: null,
      },
      include: {
        dining_tables: true,
      },
      orderBy: { opened_at: 'desc' },
    });

    return records.map(
      (r) =>
        new TableSession({
          id: r.id,
          tableId: r.table_id,
          branchId: r.branch_id,
          status: r.status,
          openedAt: r.opened_at,
          closedAt: r.closed_at,
          tableCode: r.dining_tables?.code,
          capacity: r.dining_tables?.capacity,
        }),
    );
  }

  async create(data: { table_id: number; branch_id: number }): Promise<TableSession> {
    const record = await this.prisma.table_sessions.create({
      data: {
        table_id: data.table_id,
        branch_id: data.branch_id,
        status: 'active',
        opened_at: new Date(),
      },
      include: {
        dining_tables: true,
      },
    });

    // Mark dining table as occupied / seated
    await this.prisma.dining_tables.update({
      where: { id: data.table_id },
      data: { status: 'seated' },
    });

    return new TableSession({
      id: record.id,
      tableId: record.table_id,
      branchId: record.branch_id,
      status: record.status,
      openedAt: record.opened_at,
      closedAt: record.closed_at,
      tableCode: record.dining_tables?.code,
      capacity: record.dining_tables?.capacity,
    });
  }

  async closeSession(id: number): Promise<TableSession> {
    const record = await this.prisma.table_sessions.update({
      where: { id },
      data: {
        status: 'closed',
        closed_at: new Date(),
      },
      include: {
        dining_tables: true,
      },
    });

    // Mark dining table as available
    await this.prisma.dining_tables.update({
      where: { id: record.table_id },
      data: { status: 'available' },
    });

    return new TableSession({
      id: record.id,
      tableId: record.table_id,
      branchId: record.branch_id,
      status: record.status,
      openedAt: record.opened_at,
      closedAt: record.closed_at,
      tableCode: record.dining_tables?.code,
      capacity: record.dining_tables?.capacity,
    });
  }
}
