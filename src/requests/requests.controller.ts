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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

/**
 * Controller managing the Time-Off Request lifecycle.
 * Handles submission, retrieval, manager approvals, and cancellations.
 */
@ApiTags('Time-Off Requests')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /**
   * Submits a new time-off request.
   * Enforces a submission rate limit per Employee (10 req/min).
   */
  @ApiOperation({ summary: 'Submit a new time-off request' })
  @ApiResponse({ status: 201, description: 'Request successfully submitted' })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or insufficient balance',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (e.g. submitting for others)',
  })
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
  @ApiOperation({ summary: 'List time-off requests' })
  @ApiQuery({
    name: 'employeeId',
    required: false,
    description: 'Filter by employee ID (Managers only)',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: RequestStatus,
    description: 'Filter by status',
  })
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
  @ApiOperation({ summary: 'Get details of a specific request' })
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
  @ApiOperation({ summary: 'Approve a time-off request (Manager Only)' })
  @Roles('manager')
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.approveRequest(id, managerId);
  }

  /**
   * Rejects a PENDING request. Restricted to Managers.
   */
  @ApiOperation({ summary: 'Reject a time-off request (Manager Only)' })
  @Roles('manager')
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.rejectRequest(id, managerId);
  }

  /**
   * Allows an Employee to cancel their own request.
   */
  @ApiOperation({ summary: 'Cancel a time-off request' })
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
