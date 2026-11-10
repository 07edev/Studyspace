// Usage:
//   SEED_ADMIN_EMAIL=admin@studyspace.local SEED_ADMIN_PASSWORD='Str0ngPassword!' npm run seed:admin
//   npm run seed:admin -- --reset-password      (also replace the password of an existing account)
//
// Creates the first SUPER_ADMIN (users row with role SUPER_ADMIN + an ACTIVE admin_profiles row),
// so someone can sign in to the web admin. Safe to run again: it never creates a second account
// for the same email and only changes the password when --reset-password is given.
// The password comes from the environment, or is generated and shown once. It is never stored in
// plain text. Refuses to run with NODE_ENV=production.
import '../src/load-env';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';
import { AccountStatus, AdminStatus, Role } from '../src/common/enums';
import { normalizeEmail } from '../src/common/utils/normalize';
import { loadConfig } from '../src/config/configuration';
import { PasswordService, passwordProblems } from '../src/modules/auth/password.service';
import { AdminProfile, AdminProfileSchema } from '../src/modules/identity/schemas/admin-profile.schema';
import { User, UserSchema } from '../src/modules/identity/schemas/user.schema';

async function main() {
  const config = loadConfig();
  if (config.nodeEnv === 'production') {
    throw new Error('Refusing to seed an admin account with NODE_ENV=production.');
  }
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? 'admin@studyspace.local');
  const resetPassword = process.argv.includes('--reset-password');
  const supplied = process.env.SEED_ADMIN_PASSWORD;
  // Generated passwords satisfy the strength rules: upper + lower + digit, 18 chars.
  const generated = `Aa1${randomBytes(9).toString('base64url')}`;
  const password = supplied ?? generated;
  const problems = passwordProblems(password);
  if (problems.length > 0) {
    throw new Error(`SEED_ADMIN_PASSWORD is too weak: ${problems.join(' ')}`);
  }

  await mongoose.connect(config.mongoUri);
  try {
    const users = mongoose.model(User.name, UserSchema);
    const admins = mongoose.model(AdminProfile.name, AdminProfileSchema);
    const passwordHash = await new PasswordService().hash(password);

    let user = await users.findOne({ emailNormalized: email }).select('+passwordHash');
    let passwordShown = false;
    if (!user) {
      user = await users.create({
        emailNormalized: email,
        passwordHash,
        authProviders: ['PASSWORD'],
        role: Role.SUPER_ADMIN,
        status: AccountStatus.ACTIVE,
        emailVerified: true,
        profile: { displayName: 'Super Admin' },
      });
      passwordShown = true;
      console.log(`Created SUPER_ADMIN ${email}`);
    } else {
      user.role = Role.SUPER_ADMIN;
      user.status = AccountStatus.ACTIVE;
      user.emailVerified = true;
      if (!user.authProviders.includes('PASSWORD')) {
        user.authProviders.push('PASSWORD');
      }
      if (resetPassword || !user.passwordHash) {
        user.passwordHash = passwordHash;
        passwordShown = true;
      }
      await user.save();
      console.log(`Updated existing account ${email} to SUPER_ADMIN (active).`);
    }
    await admins.updateOne(
      { userId: user._id },
      { $set: { status: AdminStatus.ACTIVE }, $setOnInsert: { permissions: [] } },
      { upsert: true },
    );
    if (passwordShown) {
      console.log(
        supplied
          ? 'Password: the value of SEED_ADMIN_PASSWORD.'
          : `Password (shown once, change it after signing in): ${password}`,
      );
    } else {
      console.log('Password unchanged (use --reset-password to replace it).');
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(error => {
  console.error('Failed:', error?.message ?? error);
  process.exit(1);
});
