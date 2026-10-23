import { IsNotEmpty, IsString, Matches } from 'class-validator';

const walletAddress = /^0x[a-fA-F0-9]{40}$/;
const tokenAmount = /^[0-9]+$/;

export class CreateGiftDto {
  @IsString()
  @IsNotEmpty()
  @Matches(walletAddress, {
    message: 'senderAddress must be a valid wallet address',
  })
  senderAddress!: string;

  @IsString()
  @Matches(tokenAmount, {
    message: 'amount must be an integer in token base units',
  })
  amount!: string;
}
