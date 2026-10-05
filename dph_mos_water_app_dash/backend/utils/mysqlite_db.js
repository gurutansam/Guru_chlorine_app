// utils/db.js
import Database from 'better-sqlite3';

const db = new Database('data.db');

// JavaScript comment – okay here
db.exec(`
  CREATE TABLE IF NOT EXISTS district_table (
    district_code TEXT PRIMARY KEY,
    district_name TEXT UNIQUE
  );


  CREATE TABLE IF NOT EXISTS district_officer_table (
    user_id TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    district_code TEXT,
    phone_number TEXT,
    address TEXT,
    aadhar_number TEXT,
    status TEXT,
    FOREIGN KEY (district_code) REFERENCES district_table(district_code)
  );

  CREATE TABLE IF NOT EXISTS corporation_master(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          district_name TEXT,
          corporation_name TEXT,
          corporation_code TEXT UNIQUE
    );
  
  CREATE TABLE IF NOT EXISTS municipality_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  district_name TEXT NOT NULL,
  corporation_name TEXT NOT NULL,
  corporation_code TEXT NOT NULL,
  municipality_name TEXT NOT NULL,
  municipality_code TEXT UNIQUE NOT NULL,
  FOREIGN KEY (corporation_code) REFERENCES corporation_master (corporation_code)
  );

  CREATE TABLE IF NOT EXISTS mosquito_corp_master_users (
  user_id TEXT,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  phone_number TEXT,
  corporation_code TEXT,
  corporation_name TEXT,
  district_name TEXT,
  role TEXT,
  module TEXT,
  status TEXT,
  email TEXT PRIMARY KEY
);

  CREATE TABLE IF NOT EXISTS mosquito_corp_users (
    user_id TEXT,
    username TEXT,
    email TEXT PRIMARY KEY,
    password TEXT,
    district_name,
    block_name TEXT,
    corp_name TEXT,
    role TEXT,
    module TEXT,
    status TEXT
  );
  
  CREATE TABLE IF NOT EXISTS mosquito_municipality_users (
    user_id TEXT ,
    email TEXT PRIMARY KEY,
    username TEXT,
    password TEXT,
    district_name TEXT,
    block_name TEXT,
    mun_name TEXT,
    role TEXT,
    module TEXT,
    status TEXT
  );

  CREATE TABLE IF NOT EXISTS datacollection (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    username TEXT,
    district_name TEXT,
    geolocation TEXT,
    areaType TEXT,
    date TEXT,
    time TEXT,
    user_geolocation TEXT,
    image_base64 TEXT
  );

CREATE TABLE IF NOT EXISTS chlorination_hub_users (
  user_id TEXT,
  username TEXT UNIQUE,
  email TEXT  PRIMARY KEY,
  hashedPassword TEXT,
  hub_id TEXT,
  hub_name TEXT,           
  phone_number TEXT,
  address TEXT,
  status TEXT,
  role TEXT,
  module TEXT
);


  CREATE TABLE IF NOT EXISTS chlorination_inspection_testers (
    tester_id TEXT PRIMARY KEY,
    tester_name TEXT,
    hub_id TEXT,
    FOREIGN KEY (hub_id) REFERENCES chlorination_users(hub_id)
  );

  -- Master table for chlorination data (HUB centre and District)
  CREATE TABLE IF NOT EXISTS chlorination_hubs (
    hub_id TEXT PRIMARY KEY,
    hub_name TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS chlorination_districts (
    district_code TEXT PRIMARY KEY,
    district_name TEXT UNIQUE,
    hub_id TEXT,
    FOREIGN KEY (hub_id) REFERENCES chlorination_hubs(hub_id)
  );

    CREATE TABLE IF NOT EXISTS chlorination_data_collectors (
    user_id TEXT,
    username TEXT,
    email TEXT  PRIMARY KEY,
    hashedPassword TEXT,
    hub_id TEXT,
    role TEXT DEFAULT 'RWAL_hi_user',
    module TEXT DEFAULT 'chlorination',
    hub_name TEXT,
    phone_number TEXT,
    FOREIGN KEY (hub_id) REFERENCES chlorination_hubs(hub_id)
  );

`);

export default db;
