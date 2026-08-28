CREATE TABLE IF NOT EXISTS service_histories (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vessel_ref VARCHAR(120) NOT NULL,
  event_date DATE NULL,
  event_type VARCHAR(80) NOT NULL DEFAULT 'service',
  title VARCHAR(255) NOT NULL,
  details TEXT NULL,
  location VARCHAR(255) NULL,
  source_reference VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  KEY idx_service_vessel(vessel_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS armament_sheets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vessel_ref VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  primary_armament TEXT NULL,
  secondary_armament TEXT NULL,
  defensive_systems TEXT NULL,
  ammunition_notes TEXT NULL,
  classification VARCHAR(80) NOT NULL DEFAULT 'standard',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uq_armament_vessel_title(vessel_ref, title),
  KEY idx_armament_vessel(vessel_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS black_box_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  vessel_ref VARCHAR(120) NOT NULL,
  file_code VARCHAR(120) NOT NULL,
  title VARCHAR(255) NOT NULL,
  incident_date DATE NULL,
  classification VARCHAR(80) NOT NULL DEFAULT 'operator-only',
  summary TEXT NULL,
  payload MEDIUMTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY(id),
  UNIQUE KEY uq_black_box_vessel_code(vessel_ref, file_code),
  KEY idx_black_box_vessel(vessel_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
