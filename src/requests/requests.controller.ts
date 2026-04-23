import { Controller, Post, Body, Get, Query, Param, Patch } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestStatus } from '../database/entities/time-off-request.entity';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async create(@Body() createRequestDto: CreateRequestDto) {
    return this.requestsService.createRequest(createRequestDto);
  }

  @Get()
  async findAll(
    @Query('employeeId') employeeId?: string,
    @Query('status') status?: RequestStatus,
  ) {
    return this.requestsService.findAll(employeeId, status);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.approveRequest(id, managerId);
  }

  @Patch(':id/reject')
  async reject(@Param('id') id: string, @Body('managerId') managerId: string) {
    return this.requestsService.rejectRequest(id, managerId);
  }

  @Patch(':id/cancel')
  async cancel(@Param('id') id: string) {
    return this.requestsService.cancelRequest(id);
  }
}
