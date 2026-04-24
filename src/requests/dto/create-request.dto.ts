import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsIn,
  IsOptional,
} from 'class-validator';

/**
 * Data Transfer Object for time-off request submission.
 * Enforces strict validation rules to ensure data integrity before reaching the domain layer.
 */
export class CreateRequestDto {
  /** Employee unique identifier */
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  /** Home location identifier */
  @IsString()
  @IsNotEmpty()
  locationId: string;

  /** Leave category (e.g., 'annual' or 'sick') */
  @IsString()
  @IsNotEmpty()
  @IsIn(['annual', 'sick'])
  leaveType: string;

  /** ISO 8601 Date string for the start of the window */
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  /** ISO 8601 Date string for the end of the window */
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  /** Optional descriptive note */
  @IsOptional()
  @IsString()
  note?: string;
}
