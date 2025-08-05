import { IsNotEmpty, IsString, Matches } from 'class-validator';

import { EMAIL_REGEX } from '../configs/regex/email.regex';
import { PASSWORD_REGEX } from '../configs/regex/password.regex';

export class SigninDTO {
  @IsNotEmpty()
  @IsString()
  @Matches(EMAIL_REGEX)
  email!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(PASSWORD_REGEX)
  password!: string;
}
