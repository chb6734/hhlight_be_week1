import { Injectable } from '@nestjs/common';
import { UserPointTable } from '../database/userpoint.table';
import { PointHistory, TransactionType, UserPoint } from './point.model';
import { PointHistoryTable } from '../database/pointhistory.table';
import { ConfigService } from '@nestjs/config';
import { Mutex } from 'async-mutex';

@Injectable()
export class PointService {
  private locks = new Map<number, Mutex>(); // 유저 별 동시성 제어

  constructor(
    private readonly userDb: UserPointTable,
    private readonly historyDb: PointHistoryTable,
    private readonly config: ConfigService,
  ) {}

  private readonly chargeLimit: number = Number(
    this.config.get<string>('CHARGE_LIMIT', '100000'),
  );

  private validateUserId(userId: number) {
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('올바르지 않은 ID 값 입니다.');
    }
  }

  private getMutexForUser(userId: number): Mutex {
    // Mutex lock chain 에 등록
    if (!this.locks.has(userId)) {
      this.locks.set(userId, new Mutex());
    }

    return this.locks.get(userId);
  }

  async getPoint(id: number): Promise<UserPoint> {
    this.validateUserId(id);
    return await this.userDb.selectById(id);
  }

  async getHistory(userId: number): Promise<PointHistory[]> {
    this.validateUserId(userId);

    return await this.historyDb.selectAllByUserId(userId);
  }

  async chargePoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('충전할 포인트는 정수여야 하며 0보다 커야합니다.');
    }

    const mutex = this.getMutexForUser(userId);
    let chargedUserPoint: UserPoint;
    await mutex.runExclusive(async () => {
      const userPoint = await this.userDb.selectById(userId);
      const updatedPoint = userPoint.point + amount;

      // NOTE Module 에서 CHARGE_LIMIT 을 주입한 값을 사용한다.
      if (updatedPoint > this.chargeLimit) {
        throw new Error(
          `충전할 수 있는 최대 포인트는 ${this.chargeLimit} 입니다.`,
        );
      }

      chargedUserPoint = await this.userDb.insertOrUpdate(userId, updatedPoint);
      await this.historyDb.insert(
        userId,
        amount,
        TransactionType.CHARGE,
        Date.now(),
      );
    });

    return chargedUserPoint;
  }

  // TODO - 특정 유저의 포인트를 사용하는 기능을 작성해주세요.
  async usePoint(userId: number, amount: number): Promise<UserPoint> {
    this.validateUserId(userId);

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('사용할 포인트는 정수여야 하며 0보다 커야합니다.');
    }

    const mutex = this.getMutexForUser(userId);
    let usedUserPoint: UserPoint;
    await mutex.runExclusive(async () => {
      const userPoint = await this.userDb.selectById(userId);
      const updatedPoint = userPoint.point - amount;

      if (updatedPoint < 0) {
        throw new Error('포인트가 부족합니다.');
      }

      usedUserPoint = await this.userDb.insertOrUpdate(userId, updatedPoint);
      await this.historyDb.insert(
        userId,
        amount,
        TransactionType.USE,
        Date.now(),
      );
    });

    return usedUserPoint;
  }
}
