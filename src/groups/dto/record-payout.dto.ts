import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RecordPayoutDto {
  @IsString()
  memberId: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
