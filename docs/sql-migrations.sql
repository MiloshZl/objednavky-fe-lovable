-- MySQL schema for rehabilitative reservation system
-- UTF-8, timezone Europe/Prague

CREATE DATABASE IF NOT EXISTS rehab_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rehab_booking;

CREATE TABLE users (
  id BIGINT NOT NULL AUTO_INCREMENT,
  login VARCHAR(64) NOT NULL,
  role ENUM('ADMIN','THERAPIST') NOT NULL,
  therapist_id BIGINT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  token_hash VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  password_version INT NOT NULL DEFAULT 0,
  password_updated_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_login (login),
  KEY idx_users_role (role),
  KEY idx_users_therapist_id (therapist_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE therapists (
  id BIGINT NOT NULL AUTO_INCREMENT,
  display_name VARCHAR(128) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE insurers (
  id BIGINT NOT NULL AUTO_INCREMENT,
  code VARCHAR(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_insurers_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE insurer_contract_periods (
  id BIGINT NOT NULL AUTO_INCREMENT,
  insurer_id BIGINT NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_contracts_insurer (insurer_id),
  KEY idx_contracts_dates (valid_from, valid_to),
  CONSTRAINT fk_insurer_contracts_insurer FOREIGN KEY (insurer_id) REFERENCES insurers(id),
  CONSTRAINT fk_insurer_contracts_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patients (
  id BIGINT NOT NULL AUTO_INCREMENT,
  therapist_id BIGINT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  birth_year SMALLINT NULL,
  phone VARCHAR(32) NOT NULL,
  insurer_id BIGINT NULL,
  insurer_type ENUM('INSURED','UNINSURED') NOT NULL,
  note TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_patients_names (last_name, first_name),
  KEY idx_patients_phone (phone),
  KEY idx_patients_insurer (insurer_id),
  KEY idx_patients_therapist (therapist_id),
  CONSTRAINT fk_patients_insurer FOREIGN KEY (insurer_id) REFERENCES insurers(id),
  CONSTRAINT fk_patients_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patient_identity_exceptions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_a_id BIGINT NOT NULL,
  patient_b_id BIGINT NOT NULL,
  confirmed_by BIGINT NOT NULL,
  confirmed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_exception_patient_a (patient_a_id),
  KEY idx_exception_patient_b (patient_b_id),
  CONSTRAINT fk_exception_patient_a FOREIGN KEY (patient_a_id) REFERENCES patients(id),
  CONSTRAINT fk_exception_patient_b FOREIGN KEY (patient_b_id) REFERENCES patients(id),
  CONSTRAINT fk_exception_confirmed_by FOREIGN KEY (confirmed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE day_templates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  therapist_id BIGINT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  valid_from DATE NOT NULL,
  valid_to DATE NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_day_templates_therapist (therapist_id),
  KEY idx_day_templates_dates (valid_from, valid_to),
  CONSTRAINT fk_templates_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id),
  CONSTRAINT fk_templates_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE schedule_templates (
  id BIGINT NOT NULL AUTO_INCREMENT,
  therapist_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_template_name (therapist_id, name),
  CONSTRAINT fk_schedule_template_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id),
  CONSTRAINT fk_schedule_template_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE schedule_template_intervals (
  id BIGINT NOT NULL AUTO_INCREMENT,
  template_id BIGINT NOT NULL,
  day_of_week TINYINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  interval_order TINYINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_schedule_template_interval (template_id, day_of_week, interval_order),
  CONSTRAINT fk_schedule_template_interval_template FOREIGN KEY (template_id) REFERENCES schedule_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE schedule_overrides (
  id BIGINT NOT NULL AUTO_INCREMENT,
  therapist_id BIGINT NOT NULL,
  override_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  is_day_off BOOLEAN NOT NULL DEFAULT FALSE,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_override_therapist_date (therapist_id, override_date),
  CONSTRAINT fk_override_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id),
  CONSTRAINT fk_override_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE schedule_override_intervals (
  id BIGINT NOT NULL AUTO_INCREMENT,
  override_id BIGINT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  interval_order TINYINT NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_override_interval_order (override_id, interval_order),
  CONSTRAINT fk_override_interval_override FOREIGN KEY (override_id) REFERENCES schedule_overrides(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE holidays (
  id BIGINT NOT NULL AUTO_INCREMENT,
  holiday_date DATE NOT NULL,
  name VARCHAR(128) NOT NULL,
  source VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Initial holiday seed for the Czech public calendar used by the app.
-- NOTE: this data must be refreshed automatically once a month and the base list
-- should be regenerated for the next calendar year before the current year ends.
INSERT INTO holidays (holiday_date, name, source) VALUES
('2026-01-01', 'Den obnovy samostatného českého státu; Nový rok', 'cz-official'),
('2026-04-03', 'Velký pátek', 'cz-official'),
('2026-04-06', 'Velikonoční pondělí', 'cz-official'),
('2026-05-01', 'Svátek práce', 'cz-official'),
('2026-05-08', 'Den vítězství', 'cz-official'),
('2026-07-05', 'Den slovanských věrozvěstů Cyrila a Metoděje', 'cz-official'),
('2026-07-06', 'Den upálení mistra Jana Husa', 'cz-official'),
('2026-09-28', 'Den české státnosti', 'cz-official'),
('2026-10-28', 'Den vzniku samostatného československého státu', 'cz-official'),
('2026-11-17', 'Den boje za svobodu a demokracii', 'cz-official'),
('2026-12-24', 'Štědrý den', 'cz-official'),
('2026-12-25', '1. svátek vánoční', 'cz-official'),
('2026-12-26', '2. svátek vánoční', 'cz-official')
ON DUPLICATE KEY UPDATE name = VALUES(name), source = VALUES(source);

CREATE TABLE reservations (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_id BIGINT NOT NULL,
  therapist_id BIGINT NOT NULL,
  start_at DATETIME NOT NULL,
  end_at DATETIME NOT NULL,
  duration_minutes SMALLINT NOT NULL,
  insurer_type_snapshot ENUM('INSURED','UNINSURED') NOT NULL,
  insurer_id_snapshot BIGINT NULL,
  status ENUM('ACTIVE','EXCUSED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  original_reservation_id BIGINT NULL,
  created_by BIGINT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reservations_patient (patient_id),
  KEY idx_reservations_therapist (therapist_id),
  KEY idx_reservations_time (start_at, end_at),
  KEY idx_reservations_status (status),
  KEY idx_reservations_calendar (therapist_id, status, start_at, end_at),
  KEY idx_reservations_insurer (insurer_id_snapshot),
  CONSTRAINT fk_reservation_insurer_snapshot FOREIGN KEY (insurer_id_snapshot) REFERENCES insurers(id),
  CONSTRAINT fk_reservation_patient FOREIGN KEY (patient_id) REFERENCES patients(id),
  CONSTRAINT fk_reservation_therapist FOREIGN KEY (therapist_id) REFERENCES therapists(id),
  CONSTRAINT fk_reservation_creator FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_original_reservation FOREIGN KEY (original_reservation_id) REFERENCES reservations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reservation_events (
  id BIGINT NOT NULL AUTO_INCREMENT,
  reservation_id BIGINT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_user_id BIGINT NOT NULL,
  event_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  old_values JSON NULL,
  new_values JSON NULL,
  PRIMARY KEY (id),
  KEY idx_events_reservation (reservation_id),
  KEY idx_events_actor (actor_user_id),
  CONSTRAINT fk_event_reservation FOREIGN KEY (reservation_id) REFERENCES reservations(id),
  CONSTRAINT fk_event_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE active_sessions (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  session_id_hash VARCHAR(255) NOT NULL,
  user_agent_hash VARCHAR(255) NOT NULL,
  device_label VARCHAR(128) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (id),
  UNIQUE KEY uq_session_hash (session_id_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor_user_id BIGINT NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  old_values JSON NULL,
  new_values JSON NULL,
  request_id VARCHAR(64) NOT NULL,
  source_ip_hash VARCHAR(255) NULL,
  user_agent_hash VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_actor (actor_user_id),
  KEY idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE rate_limit_log (
  id BIGINT NOT NULL AUTO_INCREMENT,
  key_name VARCHAR(128) NOT NULL,
  count_value INT NOT NULL,
  window_start DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rate_limit_key (key_name, window_start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed insurers (core list)
INSERT INTO insurers (code, name, is_active) VALUES
('111', 'Všeobecná zdravotní pojišťovna České republiky (VZP ČR)', TRUE),
('201', 'Vojenská zdravotní pojišťovna České republiky (VoZP ČR)', TRUE),
('205', 'Česká průmyslová zdravotní pojišťovna (ČPZP)', TRUE),
('207', 'Oborová zdravotní pojišťovna zaměstnanců bank, pojišťoven a stavebnictví (OZP)', TRUE),
('209', 'Zaměstnanecká pojišťovna Škoda (ZPŠ)', TRUE),
('211', 'Zdravotní pojišťovna ministerstva vnitra České republiky (ZP MV ČR)', TRUE),
('213', 'RBP, zdravotní pojišťovna', TRUE)
ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = VALUES(is_active);

-- Example therapist records
INSERT INTO therapists (display_name, is_active) VALUES
('Terapeutka A', TRUE),
('Terapeutka B', TRUE)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), is_active = VALUES(is_active);

-- Example admin user record (placeholder; token hash is generated by app not here)
-- Required to be created through secure admin-onboarding flow.
