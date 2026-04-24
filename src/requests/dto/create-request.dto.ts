import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsIn,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Data Transfer Object for time-off request submission.
 * Enforces strict validation rules to ensure data integrity before reaching the domain layer.
 */
export class CreateRequestDto {
  /** Employee unique identifier */
  @ApiProperty({
    description: 'The unique ID of the employee',
    example: 'emp-123',
  })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  /** Home location identifier */
  @ApiProperty({
    description: 'The ID of the employee location',
    example: 'loc-ny',
  })
  @IsString()
  @IsNotEmpty()
  locationId: string;

  /** Leave category (e.g., 'annual' or 'sick') */
  @ApiProperty({
    description: 'Category of leave',
    enum: ['annual', 'sick'],
    example: 'annual',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['annual', 'sick'])
  leaveType: string;

  /** ISO 8601 Date string for the start of the window */
  @ApiProperty({ description: 'Start date (ISO 8601)', example: '2026-06-01' })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /** ISO 8601 Date string for the end of the window */
  @ApiProperty({ description: 'End date (ISO 8601)', example: '2026-06-05' })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  /** Optional descriptive note */
  @ApiProperty({
    description: 'Optional note for the manager',
    required: false,
    example: 'Family vacation',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
