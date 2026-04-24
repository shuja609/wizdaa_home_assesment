import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Simple authentication service used for the assessment.
 * It does **not** persist users – it merely signs a JWT based on the supplied payload.
 * In a real product you would validate credentials against a user store.
 */
@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  /**
   * Returns a signed JWT containing the minimal claims required by the system.
   * Expected payload shape: { sub: string; role: 'employee' | 'manager' | 'hcm_system' }
   */
  async generateToken(payload: { sub: string; role: string }): Promise<string> {
    // In a production app you would also include iat, exp, etc.; JwtModule already handles exp.
    return this.jwtService.signAsync(payload);
  }
}
