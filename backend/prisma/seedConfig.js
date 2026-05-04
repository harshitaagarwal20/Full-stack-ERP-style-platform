export const ADMIN_SEED_USER = {
  name: "Admin User",
  email: "admin@gmail.com",
  password: "123456",
  role: "admin"
};

export const LEGACY_SEED_USER_EMAILS = [
  "admin@fms.com",
  "sales1@fms.com",
  "sales2@fms.com",
  "production@fms.com",
  "dispatch@fms.com"
];

export function getBootstrapSeedUsers() {
  return [ADMIN_SEED_USER];
}

