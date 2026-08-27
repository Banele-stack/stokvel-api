import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ContributionFrequency, GroupType } from '../entities/group.entity';

export class CreateGroupDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsIn(['stokvel', 'burial'])
  type: GroupType;

  @IsString()
  description: string;

  @IsInt()
  @Min(1)
  contributionAmount: number;

  @IsIn(['Monthly', 'Weekly'])
  frequency: ContributionFrequency;

  /** Burial societies only. */
  @IsOptional()
  @IsInt()
  @Min(1)
  payoutAmount?: number;
}
