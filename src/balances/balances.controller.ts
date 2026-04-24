import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@UseGuards(AuthGuard, RolesGuard)
@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Roles('employee', 'manager')
  @Get(':employeeId/:locationId')
  async getBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Request() req: any,
  ) {
    if (req.user.role === 'employee' && employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Employees can only view their own balances',
      );
    }
    return this.balancesService.getBalances(employeeId, locationId);
  }

  @Roles('manager')
  @Post(':employeeId/:locationId/sync')
  async syncBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balancesService.syncBalances(employeeId, locationId);
  }
}
