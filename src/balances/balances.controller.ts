import { Controller, Get, Post, Param } from '@nestjs/common';
import { BalancesService } from './balances.service';

@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get(':employeeId/:locationId')
  async getBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balancesService.getBalances(employeeId, locationId);
  }

  @Post(':employeeId/:locationId/sync')
  async syncBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balancesService.syncBalances(employeeId, locationId);
  }
}
