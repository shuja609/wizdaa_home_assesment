import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class HcmBalanceUpdateDto {
  @ApiProperty({
    description: 'The unique ID of the employee',
    example: 'emp-1',
  })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({ description: 'The location ID', example: 'loc-1' })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  @ApiProperty({ description: 'The leave type', example: 'annual' })
  @IsString()
  @IsNotEmpty()
  leaveType: string;

  @ApiProperty({ description: 'The current balance', example: 10.5 })
  @IsNumber()
  balance: number;

  @ApiProperty({
    description: 'The version of the record in HCM',
    example: 123456789,
  })
  @IsNumber()
  hcmVersion: number;
}

export class HcmBatchDto {
  @ApiProperty({
    type: [HcmBalanceUpdateDto],
    description: 'A list of balance updates to ingest',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HcmBalanceUpdateDto)
  updates: HcmBalanceUpdateDto[];
}
