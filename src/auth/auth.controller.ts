import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

/**
 * Minimal authentication controller for the assessment.
 * It accepts a simple payload and returns a JWT. No password validation is performed –
 * the goal is to provide a token that satisfies the AuthGuard and Swagger UI.
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtain a JWT for testing purposes' })
  @ApiBody({
    description:
      'Minimal login payload – in a real system you would send credentials',
    schema: {
      type: 'object',
      required: ['sub', 'role'],
      properties: {
        sub: { type: 'string', example: 'employee-123' },
        role: {
          type: 'string',
          enum: ['employee', 'manager', 'hcm_system'],
          example: 'employee',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'JWT token',
    schema: {
      type: 'object',
      properties: { access_token: { type: 'string' } },
    },
  })
  async login(@Body() payload: { sub: string; role: string }) {
    const token = await this.authService.generateToken(payload);
    return { access_token: token };
  }
}
