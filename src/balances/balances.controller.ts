import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { BalancesService } from './balances.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';

/**
 * Controller for retrieving and manually synchronizing leave balances.
 * Access is restricted to Employees (own records) and Managers (all records).
 */
@ApiTags('Balances & Sync')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  /**
   * Retrieves leave balances for a specific employee and location.
   * Enforces self-service visibility for Employees.
   */
  @ApiOperation({ summary: 'Get leave balances for an employee' })
  @ApiParam({
    name: 'employeeId',
    description: 'The unique ID of the employee',
  })
  @ApiParam({ name: 'locationId', description: 'The location ID' })
  @Roles('manager', 'employee')
  @Get(':employeeId/:locationId')
  async getBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
    @Request() req: any,
  ) {
    // F4.1: Security Identity Matching
    if (req.user.role === 'employee' && employeeId !== req.user.sub) {
      throw new ForbiddenException('Cannot access other employees balances');
    }
    return this.balancesService.getBalances(employeeId, locationId);
  }

  /**
   * Forces a real-time sync from HCM for a specific employee and location.
   * Access is restricted to Managers to prevent unnecessary HCM API load.
   */
  @ApiOperation({ summary: 'Trigger a manual sync from HCM (Manager Only)' })
  @ApiParam({
    name: 'employeeId',
    description: 'The unique ID of the employee',
  })
  @ApiParam({ name: 'locationId', description: 'The location ID' })
  @Roles('manager')
  @Post(':employeeId/:locationId/sync')
  async syncBalances(
    @Param('employeeId') employeeId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.balancesService.syncBalances(employeeId, locationId);
  }
}
