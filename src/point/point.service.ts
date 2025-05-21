import { Injectable } from '@nestjs/common';
import { UserPointTable } from 'src/database/userpoint.table';
import { UserPoint, PointHistory } from './point.model';
import { PointHistoryTable } from 'src/database/pointhistory.table';

@Injectable()
export class PointService {
  constructor(
    private readonly userDb: UserPointTable,
    private readonly historyDb: PointHistoryTable,
  ) {}

  async getPoint(id: number): Promise<UserPoint> {
    return await this.userDb.selectById(id);
  }

  async getHistory(id: number): Promise<PointHistory[]> {
    return await this.historyDb.selectAllByUserId(id);
  }
}
