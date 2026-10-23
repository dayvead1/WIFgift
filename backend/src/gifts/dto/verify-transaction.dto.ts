import { IsString, Matches } from 'class-validator';

export class VerifyTransactionDto {
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'transactionHash must be a valid transaction hash',
  })
  transactionHash!: string;
}
