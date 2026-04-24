import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  Param,
  Patch,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestStatus } from '../database/entities/time-off-request.entity';
import { AuthGuard } from '../common/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { EmployeeThrottlerGuard } from '../common/guards/employee-throttler.guard';

@UseGuards(AuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @UseGuards(EmployeeThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles('employee')
  @Post()
  async create(
    @Body() createRequestDto: CreateRequestDto,
    @Request() req: any,
  ) {
    if (createRequestDto.employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Cannot submit request for another employee',
      );
    }
    return this.requestsService.createRequest(createRequestDto);
  }

  @Roles('manager', 'employee')
  @Get()
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: RequestStatus,
    @Request() req?: any,
  ) {
    if (req.user.role === 'employee' && employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Employees can only list their own requests',
      );
    }
    return this.requestsService.findAll(employeeId, status);
  }

  @Roles('manager', 'employee')
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    const request = await this.requestsService.findOne(id);
    if (req.user.role === 'employee' && request.employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Employees can only view their own requests',
      );
    }
    return request;
  }

  @Roles('manager')
  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.approveRequest(id, managerId);
  }

  @Roles('manager')
  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.rejectRequest(id, managerId);
  }

  @Roles('employee')
  @Patch(':id/cancel')
  async cancel(@Param('id') id: string, @Request() req: any) {
    const request = await this.requestsService.findOne(id);
    if (request.employeeId !== req.user.sub) {
      throw new ForbiddenException(
        'Cannot cancel a request that does not belong to you',
      );
    }
    return this.requestsService.cancelRequest(id);
  }
}
