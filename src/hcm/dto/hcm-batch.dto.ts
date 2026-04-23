import { IsString, IsNotEmpty, IsNumber, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class HcmBalanceUpdateDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  locationId: string;

  @IsString()
  @IsNotEmpty()
  leaveType: string;

  @IsNumber()
  balance: number;

  @IsString()
  @IsNotEmpty()
  hcmVersion: string;
}

export class HcmBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HcmBalanceUpdateDto)
  updates: HcmBalanceUpdateDto[];
}
