import { Injectable } from '@nestjs/common';
import { UserPointTable } from 'src/database/userpoint.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';
import { PointHistoryTable } from 'src/database/pointhistory.table';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PointService {
  constructor(
    private readonly userDb: UserPointTable,
    private readonly historyDb: PointHistoryTable,
    private readonly config: ConfigService,
  ) {}

  private readonly chargeLimit: number = Number(
    this.config.get<string>('CHARGE_LIMIT', '100000'),
  );

  async getPoint(id: number): Promise<UserPoint> {
    return await this.userDb.selectById(id);
  }

  async getHistory(id: number): Promise<PointHistory[]> {
    return await this.historyDb.selectAllByUserId(id);
  }

  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('충전할 포인트는 정수여야 하며 0보다 커야합니다.');
    }

    const userPoint = await this.userDb.selectById(userId);
    const updatedPoint = userPoint.point + amount;

    // NOTE - Module 에서 CHARGE_LIMIT 을 주입한 값을 사용한다.
    if (updatedPoint > this.chargeLimit) {
      throw new Error(
        `충전할 수 있는 최대 포인트는 ${this.chargeLimit} 입니다.`,
      );
    }

    const chargedUserPoint: UserPoint = await this.userDb.insertOrUpdate(
      userId,
      updatedPoint,
    );
    await this.historyDb.insert(
      userId,
      amount,
      TransactionType.CHARGE,
      Date.now(),
    );

    return chargedUserPoint;
  }

  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('사용할 포인트는 정수여야 하며 0보다 커야합니다.');
    }

    const userPoint = await this.userDb.selectById(userId);
    const updatedPoint = userPoint.point - amount;

    if (updatedPoint < 0) {
      throw new Error('포인트가 부족합니다.');
    }

    const usedUserPoint: UserPoint = await this.userDb.insertOrUpdate(
      userId,
      updatedPoint,
    );
    await this.historyDb.insert(
      userId,
      amount,
      TransactionType.USE,
      Date.now(),
    );

    return usedUserPoint;
  }
}
