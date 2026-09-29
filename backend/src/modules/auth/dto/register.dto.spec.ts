import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

const base = { name: 'Nusrat', email: 'nusrat@teslapool.dev', password: 'password123' };

async function roleErrors(role: string) {
  const errors = await validate(plainToInstance(RegisterDto, { ...base, role }));
  return errors.filter((e) => e.property === 'role');
}

describe('RegisterDto.role', () => {
  it.each(['PASSENGER', 'DRIVER'])('accepts %s', async (role) => {
    expect(await roleErrors(role)).toHaveLength(0);
  });

  it('rejects ADMIN: admins are seeded, never self-registered', async () => {
    expect(await roleErrors('ADMIN')).toHaveLength(1);
  });
});
