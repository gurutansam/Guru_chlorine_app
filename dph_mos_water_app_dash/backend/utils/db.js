// utils/db.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

export const initDB = async () => {
  try {
    // 1️⃣ Connect to MySQL without selecting a DB first
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
      database: 'AI_BASED_DPH_2',
      multipleStatements: true,  // ✅ Still works on pool
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log('Connected to MySQL');

    // 2️⃣ Create the database if it doesn't exist
    await pool.query(`CREATE DATABASE IF NOT EXISTS AI_BASED_DPH_2`);
    console.log('Database checked/created');

    // 3️⃣ Switch to the database
    await pool.query(`USE AI_BASED_DPH_2`);

    // 4️⃣ Create all tables
    const createTablesSQL = `

CREATE TABLE IF NOT EXISTS admin_users (
  user_id VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  hub_id VARCHAR(100) DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'active',
  district_name VARCHAR(255) DEFAULT NULL,
  block_name VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (user_id),
  UNIQUE KEY email (email),
  UNIQUE KEY username (username)
) ;

CREATE TABLE IF NOT EXISTS developer_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(50) UNIQUE,
  email VARCHAR(100) UNIQUE,
  username VARCHAR(100),
  password VARCHAR(255),
  role VARCHAR(30),
  status ENUM('ACTIVE','INACTIVE') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chlorine_hud_data_collection(
   id INT PRIMARY KEY AUTO_INCREMENT,
    ppm DECIMAL(10, 2),
    actualPPM DECIMAL(10, 2),
    samplingPoint VARCHAR(50),
    image_path TEXT,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    timestamp VARCHAR(30) NOT NULL,
    address TEXT,
    block_id VARCHAR(20),
    block_name VARCHAR(100),
    hud_id VARCHAR(20),
    hud_name VARCHAR(20),
    user_id VARCHAR(50),
    username VARCHAR(100)
   
);

CREATE TABLE IF NOT EXISTS chlorine_hud_data_collection_new(
   id INT PRIMARY KEY AUTO_INCREMENT,
    ppm DECIMAL(10, 2),
    actualPPM DECIMAL(10, 2),
    samplingPoint VARCHAR(50),
    image_path TEXT,
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    timestamp VARCHAR(30) NOT NULL,
    address TEXT,
    block_id VARCHAR(20),
    block_name VARCHAR(100),
    hud_id VARCHAR(20),
    hud_name VARCHAR(20),
    user_id VARCHAR(50),
    username VARCHAR(100)
   
);


      CREATE TABLE IF NOT EXISTS district_table (
        district_code VARCHAR(20) PRIMARY KEY,
        district_name VARCHAR(255) UNIQUE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS mosquito_district_master (
        district_code VARCHAR(20) PRIMARY KEY,
        district_name VARCHAR(255) UNIQUE
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS district_officer_table (
        user_id VARCHAR(100),
        email VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        district_code VARCHAR(20),
        district_name VARCHAR(255),
        phone_number VARCHAR(20),
        status VARCHAR(50),
        role VARCHAR(50),
        module VARCHAR(50),
        FOREIGN KEY (district_code) REFERENCES mosquito_district_master(district_code)
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS datacollection (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(100),
        username VARCHAR(255),
        district_name VARCHAR(255),
        geolocation TEXT,
        selected_area VARCHAR(100),
        date DATE,
        time TIME,
        user_geolocation TEXT,
        image_base64 LONGTEXT,
        address TEXT,
        block_name TEXT,
        monitoringArea TEXT
      ) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chlorination_hub_users (
  user_id VARCHAR(100) UNIQUE,
  username VARCHAR(255) ,
  email VARCHAR(255) PRIMARY KEY,
  hashedPassword VARCHAR(255),
  hub_id VARCHAR(100),
  hub_name VARCHAR(255),
  phone_number VARCHAR(20),
  address TEXT,
  status VARCHAR(50),
  role VARCHAR(50),
  module VARCHAR(50)
) ENGINE=InnoDB;


      CREATE TABLE IF NOT EXISTS chlorination_govt_holiday (
       id INT AUTO_INCREMENT PRIMARY KEY,
        holiday_name VARCHAR(255) NOT NULL,
        date DATE NOT NULL
      ) ENGINE=InnoDB;


      CREATE TABLE IF NOT EXISTS chlorination_hubs (
        hub_id VARCHAR(100) PRIMARY KEY,
        hub_name VARCHAR(255) ,
        latitude VARCHAR(100),
        longitude VARCHAR(100)
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS chlorination_districts (
        district_code VARCHAR(20) PRIMARY KEY,
        district_name VARCHAR(255) UNIQUE,
        hub_id VARCHAR(100),
        FOREIGN KEY (hub_id) REFERENCES chlorination_hubs(hub_id)
      ) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chlorination_data_collectors (
  user_id VARCHAR(255),
  username VARCHAR(255),
  email VARCHAR(255) PRIMARY KEY,
  hashedPassword VARCHAR(255),
  hub_id VARCHAR(255),
  hub_name VARCHAR(255),
  phone_number VARCHAR(255),
  role VARCHAR(255),
  module VARCHAR(255),
  FOREIGN KEY (hub_id) REFERENCES chlorination_hubs(hub_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS chlorine_data_collection (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,

    ppm DECIMAL(6,3) NOT NULL,
    actualPPM DECIMAL(6,3),

    samplingPoint VARCHAR(20) NOT NULL,

    image_path VARCHAR(500) NOT NULL,

    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,

    timestamp VARCHAR(20) NOT NULL,

    address VARCHAR(1000) NOT NULL,

    hub_id VARCHAR(50),
    hub_name VARCHAR(100),

    user_id VARCHAR(100),
    username VARCHAR(100)
) ;


CREATE TABLE IF NOT EXISTS hud_master (
    hud_id VARCHAR(100) PRIMARY KEY,
    hud_name VARCHAR(255) UNIQUE NOT NULL,
    hub_id VARCHAR(100) NOT NULL,
    hub_name VARCHAR(255) NOT NULL,
    CONSTRAINT fk_hub
    FOREIGN KEY (hub_id) REFERENCES chlorination_hubs(hub_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;

  CREATE TABLE IF NOT EXISTS mosquito_blocks_master (
    block_id VARCHAR(100) PRIMARY KEY,
    block_name VARCHAR(255) NOT NULL,
        district_code VARCHAR(20) NOT NULL,
        district_name VARCHAR(255) NOT NULL
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS mosquito_block_users (
        user_id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone_number VARCHAR(20),
        district_code VARCHAR(20),
        district_name VARCHAR(255),
        block_id VARCHAR(100) NOT NULL,
        block_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        module VARCHAR(50) DEFAULT 'mosquito',
        role VARCHAR(50) DEFAULT 'block_user'
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS mosquito_block_datacollector (
        user_id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone_number VARCHAR(20),
        district_id VARCHAR(100) NOT NULL,
        district_name VARCHAR(255),
        block_id VARCHAR(100) NOT NULL,
        block_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'Active',
        module VARCHAR(50) DEFAULT 'mosquito',
        role VARCHAR(50) DEFAULT 'data_collector'
      ) ENGINE=InnoDB;

      CREATE TABLE IF NOT EXISTS chlorination_corporation_master (
        id INT AUTO_INCREMENT PRIMARY KEY,
        hub_id VARCHAR(100) NOT NULL,
        hub_name VARCHAR(255) NOT NULL,
        district_id VARCHAR(100) NOT NULL,
        district_name VARCHAR(255) NOT NULL,
        corporation_name VARCHAR(255) NOT NULL,
        latitude VARCHAR(100),
        longitude VARCHAR(100),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
              
      CREATE TABLE IF NOT EXISTS corporation_master(
        id INT AUTO_INCREMENT PRIMARY KEY,
          district_name VARCHAR(255) NOT NULL,
        corporation_name VARCHAR(255) NOT NULL,   
        corporation_code  VARCHAR(100) NOT NULL UNIQUE
    ); 

CREATE TABLE IF NOT EXISTS municipality_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  district_name VARCHAR(255) NOT NULL,
  corporation_name VARCHAR(255) NOT NULL,
  corporation_code VARCHAR(100) NOT NULL,
  municipality_name VARCHAR(255) NOT NULL,
  municipality_code VARCHAR(100) NOT NULL UNIQUE,
  FOREIGN KEY (corporation_code) REFERENCES corporation_master(corporation_code)
) ;


CREATE TABLE IF NOT EXISTS mosquito_corp_master_users (
  user_id VARCHAR(255),
  username VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),
  corporation_code VARCHAR(100),
  corporation_name VARCHAR(255),
  district_name VARCHAR(255),
  role VARCHAR(100),
  module VARCHAR(100),
  status VARCHAR(50),
  email VARCHAR(255) PRIMARY KEY
) ;



CREATE TABLE IF NOT EXISTS mosquito_corp_users (
  user_id VARCHAR(255) UNIQUE,
  username VARCHAR(255),
  password VARCHAR(255),
  district_name VARCHAR(255),
  block_name VARCHAR(255),
  corp_name VARCHAR(255),
  role VARCHAR(100),
  module VARCHAR(100),
  status VARCHAR(50),
  phone_number VARCHAR(100),
  email VARCHAR(255) PRIMARY KEY
) ;


CREATE TABLE IF NOT EXISTS mosquito_municipality_users (
  user_id VARCHAR(255),
  username VARCHAR(255),
  password VARCHAR(255),
  district_name VARCHAR(255),
  municipality_name VARCHAR(255),
  role VARCHAR(100),
  module VARCHAR(100),
  status VARCHAR(50),
  phone_number VARCHAR(50),
  email VARCHAR(255) PRIMARY KEY
) ;


      

CREATE TABLE IF NOT EXISTS chl_hud_block_users (
  user_id VARCHAR(50),
  username VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,
  hud_id VARCHAR(50) NOT NULL,
  hud_name VARCHAR(100) NOT NULL,
  block_id VARCHAR(50) NOT NULL,
  block_name VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL DEFAULT 'chlorination',
  role VARCHAR(50) NOT NULL DEFAULT 'block_user',
  status VARCHAR(20) NOT NULL DEFAULT 'Active',
  PRIMARY KEY (email)
) ;

CREATE TABLE IF NOT EXISTS mos_mun_master_table (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  district_name varchar(255) NOT NULL,
  corporation_name varchar(255) NOT NULL,
  corporation_code varchar(100) DEFAULT NULL,
  municipality_name varchar(255) NOT NULL,
  module varchar(50) NOT NULL DEFAULT 'mosquito',
  municipality_id varchar(100) DEFAULT NULL
) ;



CREATE TABLE IF NOT EXISTS mos_mun_master_users (
  user_id varchar(100) DEFAULT NULL,
  username varchar(255) DEFAULT NULL,
  password varchar(255) DEFAULT NULL,
  phone_number varchar(20) DEFAULT NULL,
  email varchar(255) NOT NULL,
  corporation_name varchar(255) DEFAULT NULL,
  corporation_code varchar(100) DEFAULT NULL,
  district_name varchar(255) DEFAULT NULL,
  municipality_name varchar(255) DEFAULT NULL,
  municipality_id varchar(100) DEFAULT NULL,
  role varchar(50) DEFAULT NULL,
  module varchar(50) DEFAULT NULL,
  status varchar(50) DEFAULT NULL,
  PRIMARY KEY (email)
) ;

CREATE TABLE  IF NOT EXISTS chlorination_prison_master (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hub_id varchar(100) NOT NULL,
  hub_name varchar(255) NOT NULL,
  district_name varchar(255) NOT NULL,
  prison_name varchar(255) NOT NULL,
  latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp()
) ;


CREATE TABLE  IF NOT EXISTS chlorination_pwd_master (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hub_id varchar(100) NOT NULL,
  hub_name varchar(255) NOT NULL,
  district_name varchar(255) NOT NULL,
  pwd_name varchar(255) NOT NULL,
  latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp()
) ;



CREATE TABLE  IF NOT EXISTS chlorination_railway_station_master (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hub_id varchar(100) NOT NULL,
  hub_name varchar(255) NOT NULL,
  district_name varchar(255) NOT NULL,
  station_name varchar(255) NOT NULL,
  latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp()
) ;



CREATE TABLE  IF NOT EXISTS chlorination_sent_emails (
  user_id varchar(100) NOT NULL,
  hub_id varchar(100) NOT NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  PRIMARY KEY (user_id,hub_id,from_date,to_date)
) ;



CREATE TABLE  IF NOT EXISTS chlorination_townpanchayat_master(
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hub_id varchar(100) NOT NULL,
  hub_name varchar(255) NOT NULL,
  district_name varchar(255) NOT NULL,
  townpanchayat_name varchar(255) NOT NULL,
  latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp()
) ;

 


CREATE TABLE  IF NOT EXISTS hud_master_users (
  user_id varchar(100) NOT NULL,
  username varchar(255) NOT NULL,
  password varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  phone_number varchar(20) NOT NULL,
  hud_id varchar(100) NOT NULL,
  hud_name varchar(255) NOT NULL,
  role varchar(50) DEFAULT 'DHO',
  module varchar(50) DEFAULT 'chlorination',
  status varchar(50) DEFAULT 'Active',
  PRIMARY KEY (user_id)
) ;


CREATE TABLE  IF NOT EXISTS inspection_plan_status (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id varchar(100) NOT NULL,
  location_name varchar(255) NOT NULL,
  district varchar(255) DEFAULT NULL,
  hub_id varchar(100) NOT NULL,
  accepted tinyint(1) NOT NULL,
  reason text DEFAULT NULL,
  timestamp varchar(255) NOT NULL,
  username varchar(255) NOT NULL,
  hub_name varchar(255) NOT NULL,
  flag text DEFAULT NULL,
  visited text DEFAULT NULL,
  remarks text DEFAULT NULL
) ;

CREATE TABLE IF NOT EXISTS chlorination_government_hospital_master (
  id int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  hub_id varchar(20) DEFAULT NULL,
  hub_name varchar(100) DEFAULT NULL,
  district_name varchar(100) DEFAULT NULL,
  hospital_name varchar(255) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL
) ;





CREATE TABLE IF NOT EXISTS chlorination_institution_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hub_id VARCHAR(20),
  hub_name VARCHAR(100),
  district_name VARCHAR(100),
  institution_name VARCHAR(255),
  created_at DATETIME,
latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL
) ;


CREATE TABLE IF NOT EXISTS chlorination_governmentinstitution_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hub_id VARCHAR(20),
  hub_name VARCHAR(100),
  district_name VARCHAR(100),
  institution_name VARCHAR(255),
  created_at datetime DEFAULT current_timestamp(),
  latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL
) ;

CREATE TABLE IF NOT EXISTS chlorination_approved_home_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hub_id VARCHAR(20),
  hub_name VARCHAR(100),
  district_name VARCHAR(100),
  approvedhome_name VARCHAR(255),
 created_at datetime DEFAULT current_timestamp(),
  latitude varchar(100) DEFAULT NULL,
  longitude varchar(100) DEFAULT NULL
) ;

CREATE TABLE IF NOT EXISTS chlorination_educationalinstitution_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hub_id VARCHAR(100) NOT NULL,
  hub_name VARCHAR(255) NOT NULL,
  district_name VARCHAR(255) NOT NULL,
  institution_name VARCHAR(255) NOT NULL,
  latitude VARCHAR(100) DEFAULT NULL,
  longitude VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ;

CREATE TABLE IF NOT EXISTS hud_block_master (
  block_id VARCHAR(100) PRIMARY KEY,
  block_name VARCHAR(255) NOT NULL,
  hud_id VARCHAR(100) NOT NULL,
  hud_name VARCHAR(255) NOT NULL
) ;

CREATE TABLE IF NOT EXISTS phc_master (
  phc_id VARCHAR(100) PRIMARY KEY,
  phc_name VARCHAR(255) NOT NULL,
  hud_id VARCHAR(100) NOT NULL,
  hud_name VARCHAR(255) NOT NULL,
  block_id VARCHAR(100) NOT NULL,
  block_name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS hud_village_master (
  hud_id VARCHAR(100) DEFAULT NULL,
  hud_name VARCHAR(255) DEFAULT NULL,
  block_id VARCHAR(100) DEFAULT NULL,
  block_name VARCHAR(255) DEFAULT NULL,
  phc_id VARCHAR(100) DEFAULT NULL,
  phc_name VARCHAR(255) DEFAULT NULL,
  village_id VARCHAR(100),
  village_name VARCHAR(255) DEFAULT NULL
);

 
CREATE TABLE IF NOT EXISTS chlorination_municipality_master (
  id INT AUTO_INCREMENT PRIMARY KEY,
  hub_id VARCHAR(100) NOT NULL,
  hub_name VARCHAR(255) NOT NULL,
  district_name VARCHAR(255) NOT NULL,
  municipality_name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8) DEFAULT NULL,
  longitude DECIMAL(10,8) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ;

CREATE TABLE IF NOT EXISTS village_users (
  user_id VARCHAR(100),
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL PRIMARY KEY,
  hashedPassword VARCHAR(255) NOT NULL,
  block_id VARCHAR(100),
  block_name VARCHAR(255),
  role VARCHAR(50) DEFAULT 'hi_user',
  module VARCHAR(50) DEFAULT 'chlorination',
  phone_number VARCHAR(20),
  hud_id VARCHAR(100),           -- Health Unit District ID (if needed)
  hud_name VARCHAR(100)
) ;

CREATE TABLE IF NOT EXISTS village_water_sample_plan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  district VARCHAR(100),
  hud_id VARCHAR(100),
  hud_name VARCHAR(255),
  block_id VARCHAR(100),
  block_name VARCHAR(255),
  village_id VARCHAR(100),
  village_name VARCHAR(255),
  month VARCHAR(32),
  samples INT,
  date DATE
) ;

CREATE TABLE IF NOT EXISTS dbc_hi_monitoring (
    id INT NOT NULL AUTO_INCREMENT,
    user_id VARCHAR(255),
    hi_name VARCHAR(255) NOT NULL,
    block_name VARCHAR(255),
    district_name VARCHAR(255),

    phc_name VARCHAR(255) NULL,
    village_name VARCHAR(255) NULL,

    num_dbcs INT,
    dbc_data TEXT,               -- JSON string of DBC array
    total_visited INT,
    total_target INT,
    verified VARCHAR(10),        -- Yes / No / null

    -- Photo 1 to 10 with lat/long
    photo1 TEXT,
    photo1_lat DOUBLE,
    photo1_long DOUBLE,
    photo2 TEXT,
    photo2_lat DOUBLE,
    photo2_long DOUBLE,
    photo3 TEXT,
    photo3_lat DOUBLE,
    photo3_long DOUBLE,
    photo4 TEXT,
    photo4_lat DOUBLE,
    photo4_long DOUBLE,
    photo5 TEXT,
    photo5_lat DOUBLE,
    photo5_long DOUBLE,
    photo6 TEXT,
    photo6_lat DOUBLE,
    photo6_long DOUBLE,
    photo7 TEXT,
    photo7_lat DOUBLE,
    photo7_long DOUBLE,
    photo8 TEXT,
    photo8_lat DOUBLE,
    photo8_long DOUBLE,
    photo9 TEXT,
    photo9_lat DOUBLE,
    photo9_long DOUBLE,
    photo10 TEXT,
    photo10_lat DOUBLE,
    photo10_long DOUBLE,

    timestamp DATETIME,          -- ISO format
    PRIMARY KEY (id)
);


CREATE TABLE IF NOT EXISTS dbc_hi_monitoring_special (
    id INT NOT NULL AUTO_INCREMENT,

    -- USER / ROLE INFO (SPECIAL CONTEXT)
    user_id VARCHAR(255),
    role VARCHAR(50) NOT NULL,

    -- HI / LOCATION DETAILS
    hi_name VARCHAR(255) NOT NULL,
    block_name VARCHAR(255),
    district_name VARCHAR(255),

    phc_name VARCHAR(255) NULL,
    village_name VARCHAR(255) NULL,

    -- OPTIONAL HUD CONTEXT (for DHO / block / admin)
    hud_id VARCHAR(50) NULL,
    hud_name VARCHAR(255) NULL,

    -- DBC DETAILS
    num_dbcs INT,
    dbc_data TEXT,               -- JSON string of DBC array
    total_visited INT,
    total_target INT,
    verified VARCHAR(10),        -- Yes / No / null

    -- Photo 1 to 10 with lat/long (UNCHANGED)
    photo1 TEXT,
    photo1_lat DOUBLE,
    photo1_long DOUBLE,
    photo2 TEXT,
    photo2_lat DOUBLE,
    photo2_long DOUBLE,
    photo3 TEXT,
    photo3_lat DOUBLE,
    photo3_long DOUBLE,
    photo4 TEXT,
    photo4_lat DOUBLE,
    photo4_long DOUBLE,
    photo5 TEXT,
    photo5_lat DOUBLE,
    photo5_long DOUBLE,
    photo6 TEXT,
    photo6_lat DOUBLE,
    photo6_long DOUBLE,
    photo7 TEXT,
    photo7_lat DOUBLE,
    photo7_long DOUBLE,
    photo8 TEXT,
    photo8_lat DOUBLE,
    photo8_long DOUBLE,
    photo9 TEXT,
    photo9_lat DOUBLE,
    photo9_long DOUBLE,
    photo10 TEXT,
    photo10_lat DOUBLE,
    photo10_long DOUBLE,

    -- TIME
    timestamp DATETIME,          -- Same as normal table

    -- AUDIT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    -- INDEXES (MATCH + SPECIAL)
    INDEX idx_user (user_id),
    INDEX idx_role (role),
    INDEX idx_hi_name (hi_name),
    INDEX idx_block (block_name),
    INDEX idx_district (district_name),
    INDEX idx_phc (phc_name),
    INDEX idx_village (village_name),
    INDEX idx_hud (hud_id, hud_name),
    INDEX idx_timestamp (timestamp)
);

CREATE TABLE IF NOT EXISTS larva_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    hi_name VARCHAR(100) NOT NULL,
    mobile_no VARCHAR(15) NULL,
    block_name VARCHAR(100) NULL,
    district_name VARCHAR(100) NULL,
    phc_name VARCHAR(100) NULL,
    village_name VARCHAR(100) NULL,
    work_type VARCHAR(50) NOT NULL,
    image_path VARCHAR(255) NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    submitted_at DATETIME NULL,
    sources JSON NOT NULL,
    active_larval_source_count INT DEFAULT 0,
    overallSourceCount INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    action_image_path VARCHAR(255) NULL,
    action_date DATETIME NULL,
    action_taken TEXT NULL,
    action_location TEXT NULL,
    INDEX idx_user (user_id),
    INDEX idx_hi_name (hi_name), 
    INDEX idx_block (block_name),
    INDEX idx_district (district_name),
    INDEX idx_phc (phc_name),
    INDEX idx_village (village_name),
    INDEX idx_work_type (work_type),
    INDEX idx_date (submitted_at),
    INDEX idx_location (latitude, longitude),
    INDEX idx_overallSourceCount  (overallSourceCount)
);

CREATE TABLE IF NOT EXISTS larva_special_data_collection (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- USER / ROLE INFO
    user_id VARCHAR(50) NOT NULL,
    role VARCHAR(50) NOT NULL,

    -- HI / LOCATION DETAILS
    hi_name VARCHAR(100) NOT NULL,
    mobile_no VARCHAR(15) NULL,
    block_name VARCHAR(100) NULL,
    district_name VARCHAR(100) NULL,
    phc_name VARCHAR(100) NULL,
    village_name VARCHAR(100) NULL,

    -- OPTIONAL HUD CONTEXT (for special users)
    hud_id VARCHAR(50) NULL,
    hud_name VARCHAR(100) NULL,

    -- WORK DETAILS
    work_type VARCHAR(50) NOT NULL,
    image_path VARCHAR(255) NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,

    -- DATE / SOURCE INFO
    submitted_at DATETIME NULL,
    sources JSON NOT NULL,
    active_larval_source_count INT DEFAULT 0,
    overallSourceCount INT DEFAULT 0,

    -- AUDIT COLUMNS
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- ACTION TAKEN DETAILS
    action_image_path VARCHAR(255) NULL,
    action_date DATETIME NULL,
    action_taken TEXT NULL,
    action_location TEXT NULL,

    -- INDEXES (MATCHING ORIGINAL + ROLE)
    INDEX idx_user (user_id),
    INDEX idx_role (role),
    INDEX idx_hi_name (hi_name),
    INDEX idx_block (block_name),
    INDEX idx_district (district_name),
    INDEX idx_phc (phc_name),
    INDEX idx_village (village_name),
    INDEX idx_work_type (work_type),
    INDEX idx_date (submitted_at),
    INDEX idx_location (latitude, longitude),
    INDEX idx_overallSourceCount (overallSourceCount),
    INDEX idx_hud (hud_id, hud_name)
);

CREATE TABLE IF NOT EXISTS chlorine_special_data_collection (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ppm DECIMAL(5,2),
  actualPPM DECIMAL(5,2),
  samplingPoint VARCHAR(20),
  image_path VARCHAR(255),
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  timestamp VARCHAR(20) NOT NULL,
  user_id VARCHAR(50),
  username VARCHAR(150),
  role VARCHAR(50),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS chlorine_block_data_collection (
  id INT AUTO_INCREMENT PRIMARY KEY,

  ppm DECIMAL(6,2),
  actualPPM DECIMAL(6,2),

  samplingPoint VARCHAR(20),
  image_path VARCHAR(255),

  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),

  timestamp VARCHAR(50),   -- ✅ changed

  hud_id VARCHAR(50),
  hud_name VARCHAR(100),

  block_id VARCHAR(50),
  block_name VARCHAR(100),

  user_id VARCHAR(50),
  username VARCHAR(100),

  role VARCHAR(30),        -- ✅ added

  address TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


`;



    await pool.query(createTablesSQL);
    console.log('Tables created or verified');

    // Helper to dynamically create indexes if they do not exist
    const createIndexIfNotExists = async (tableName, indexName, columns) => {
      try {
        const [rows] = await pool.query(
          `SELECT 1 FROM information_schema.statistics 
           WHERE table_schema = DATABASE() 
           AND table_name = ? 
           AND index_name = ? 
           LIMIT 1`,
          [tableName, indexName]
        );
        if (rows.length === 0) {
          await pool.query(`ALTER TABLE ${tableName} ADD INDEX ${indexName} (${columns})`);
          console.log(`Created index ${indexName} on ${tableName}`);
        }
      } catch (err) {
        console.error(`Failed to create index ${indexName} on ${tableName}:`, err);
      }
    };

    await createIndexIfNotExists('chlorine_hud_data_collection', 'idx_hud_name', 'hud_name');
    await createIndexIfNotExists('chlorine_hud_data_collection', 'idx_block_name', 'block_name');
    await createIndexIfNotExists('chlorine_hud_data_collection', 'idx_hud_id', 'hud_id');
    await createIndexIfNotExists('chlorine_hud_data_collection', 'idx_block_id', 'block_id');
    await createIndexIfNotExists('chlorine_hud_data_collection', 'idx_timestamp', 'timestamp');

    await createIndexIfNotExists('chlorine_hud_data_collection_new', 'idx_hud_name_new', 'hud_name');
    await createIndexIfNotExists('chlorine_hud_data_collection_new', 'idx_block_name_new', 'block_name');
    await createIndexIfNotExists('chlorine_hud_data_collection_new', 'idx_hud_id_new', 'hud_id');
    await createIndexIfNotExists('chlorine_hud_data_collection_new', 'idx_block_id_new', 'block_id');
    await createIndexIfNotExists('chlorine_hud_data_collection_new', 'idx_timestamp_new', 'timestamp');

    try {
      await pool.query(`
        ALTER TABLE village_users 
        MODIFY COLUMN hud_id VARCHAR(100), 
        MODIFY COLUMN hud_name VARCHAR(255), 
        MODIFY COLUMN block_id VARCHAR(100), 
        MODIFY COLUMN block_name VARCHAR(255)
      `);
      console.log('Modified village_users columns to VARCHAR');
    } catch (err) {
      console.warn("Could not modify village_users columns to VARCHAR:", err.message);
    }

    await createIndexIfNotExists('village_users', 'idx_hud_id_vu', 'hud_id');
    await createIndexIfNotExists('village_users', 'idx_hud_name_vu', 'hud_name');
    await createIndexIfNotExists('village_users', 'idx_block_id_vu', 'block_id');
    await createIndexIfNotExists('village_users', 'idx_block_name_vu', 'block_name');

    return pool;// return ready MySQL connection for queries
  } catch (err) {
    console.error('Database initialization error:', err);
    process.exit(1);
  }
};

// Immediately initialize DB and export the connection
const db = await initDB();
export default db;