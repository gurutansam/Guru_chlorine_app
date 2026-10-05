export type UserRole =
  | 'hi_user'
  | 'block_user'
  | 'RWAL_hi_user'
  | 'special_user'
  | 'DHO'
  | 'chl_admin'
  | 'mos_admin';

export type User = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};