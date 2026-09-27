import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ITableSessionRepository,
  TABLE_SESSION_REPOSITORY,
} from '../domain/table-session.repository.interface';
import { TableSession } from '../domain/table-session.entity';

@Injectable()
export class TableSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TABLE_SESSION_REPOSITORY)
    private readonly repo: ITableSessionRepository,
  ) {}

  async resolveByQr(qrToken: string) {
    const table = await this.prisma.dining_tables.findUnique({
      where: { qr_token: qrToken },
      include: {
        branches: true,
      },
    });

    if (!table) {
      throw new NotFoundException(`Invalid QR code token: ${qrToken}`);
    }

    let session = await this.repo.findActiveByTable(table.id, table.branch_id);
    if (!session) {
      session = await this.repo.create({
        table_id: table.id,
        branch_id: table.branch_id,
      });
    }

    return {
      table: {
        id: table.id,
        code: table.code,
        capacity: table.capacity,
        status: table.status,
      },
      session: {
        id: session.id,
        status: session.status,
        opened_at: session.openedAt,
      },
      branch_id: table.branch_id,
    };
  }

  async getActiveSessions(branchId: number): Promise<TableSession[]> {
    return this.repo.findActiveByBranch(branchId);
  }

  async listTables(branchId: number = 8) {
    return this.prisma.dining_tables.findMany({
      where: { branch_id: branchId },
      orderBy: { code: 'asc' },
    });
  }

  async getSessionDetails(id: number, branchId: number) {
    const session = await this.prisma.table_sessions.findFirst({
      where: { id, branch_id: branchId },
      include: {
        dining_tables: true,
        guest_sessions: true,
        orders: {
          include: {
            order_items: {
              include: {
                menu_items: true,
              },
            },
          },
          orderBy: { id: 'desc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Table session #${id} not found in branch #${branchId}`);
    }

    return session;
  }

  async closeSession(id: number, branchId: number): Promise<TableSession> {
    const session = await this.repo.findById(id);
    if (!session || session.branchId !== branchId) {
      throw new NotFoundException(`Session #${id} not found in branch #${branchId}`);
    }

    if (!session.isActive()) {
      throw new BadRequestException(`Session #${id} is already closed`);
    }

    return this.repo.closeSession(id);
  }
}
