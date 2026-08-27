import { IsOptional, IsString } from 'class-validator';

/** Marks one member's contribution as Paid for a cycle. Defaults to the
 * current cycle and today's date if not given — the common case is "record
 * that they paid, just now, for this cycle." */
export class MarkContributionDto {
  @IsOptional()
  @IsString()
  cyclePeriod?: string;

  @IsOptional()
  @IsString()
  paidDate?: string;
}
