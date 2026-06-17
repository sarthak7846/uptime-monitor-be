import { PartialType } from '@nestjs/mapped-types';
import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateStatusPageDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  monitorIds?: string[];
}

export class UpdateStatusPageDto extends PartialType(CreateStatusPageDto) {}
