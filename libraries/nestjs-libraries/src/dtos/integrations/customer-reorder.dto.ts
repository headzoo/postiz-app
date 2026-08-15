import { IsDefined, IsIn } from 'class-validator';

export class ReorderCustomerDto {
  @IsDefined()
  @IsIn(['up', 'down'])
  direction: 'up' | 'down';
}
