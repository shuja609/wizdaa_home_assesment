import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestStatus } from '../database/entities/time-off-request.entity';
import { AuthGuard } from '../common/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { EmployeeThrottlerGuard } from '../common/guards/employee-throttler.guard';

/**
 * Controller managing the Time-Off Request lifecycle.
 * Handles submission, retrieval, manager approvals, and cancellations.
 */
@UseGuards(AuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /**
   * Submits a new time-off request.
   * Enforces a submission rate limit per Employee (10 req/min).
   */
  @UseGuards(EmployeeThrottlerGuard)
  @Roles('employee')
  @Post()
  async create(@Body() createDto: CreateRequestDto, @Request() req: any) {
    // F4.1: Security Identity Matching
    if (createDto.employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Cannot submit requests for other employees',
      );
    }
    return this.requestsService.createRequest(createDto);
  }

  /**
   * Retrieves a list of requests based on employee or status filters.
   * Employees are restricted to their own history.
   */
  @Roles('manager', 'employee')
  @Get()
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: RequestStatus,
    @Request() req?: any,
  ) {
    // F4.1: Security Identity Matching
    if (req.user.role === 'employee') {
      employeeId = req.user.sub;
    }
    return this.requestsService.findAll(employeeId, status);
  }

  /**
   * Fetches detailed information for a single request.
   */
  @Roles('manager', 'employee')
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const request = await this.requestsService.findOne(id);
    // F4.1: Security Identity Matching
    if (req.user.role === 'employee' && request.employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Employees can only view their own requests',
      );
    }
    return request;
  }

  /**
   * Approves a PENDING request. Restricted to Managers.
   */
  @Roles('manager')
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.approveRequest(id, managerId);
  }

  /**
   * Rejects a PENDING request. Restricted to Managers.
   */
  @Roles('manager')
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.rejectRequest(id, managerId);
  }

  /**
   * Allows an Employee to cancel their own request.
   */
  @Roles('employee')
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    const request = await this.requestsService.findOne(id);
    // F4.1: Security Identity Matching
    if (request.employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Cannot cancel a request that does not belong to you',
      );
    }
    return this.requestsService.cancelRequest(id);
  }
}
