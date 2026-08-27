import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMemberDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  joinedDate?: string;
}
