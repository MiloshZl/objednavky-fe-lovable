# Datový model – MySQL

## 1. users
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | interní ID |
| login | varchar(64) | unikátní |
| role | enum('ADMIN','THERAPIST') | |
| therapist_id | bigint nullable | vazba na terapeutku |
| is_active | boolean | |
| token_hash | varchar(255) | hash 32znakového tokenu |
| created_at | datetime | |
| updated_at | datetime | |
| last_login_at | datetime nullable | |

## 2. therapists
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| display_name | varchar(128) | |
| is_active | boolean | |
| created_at | datetime | |
| updated_at | datetime | |

## 3. patients
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| first_name | varchar(120) | |
| last_name | varchar(120) | |
| birth_year | smallint nullable | povinné pro pojištěného |
| phone | varchar(32) | povinné |
| insurer_id | bigint nullable | vazba na pojišťovnu |
| insurer_type | enum('INSURED','UNINSURED') | |
| note | text nullable | |
| is_active | boolean | |
| created_at | datetime | |
| updated_at | datetime | |

## 4. insurers
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| code | varchar(16) | např. 111 |
| name | varchar(255) | |
| is_active | boolean | |
| created_at | datetime | |
| updated_at | datetime | |

## 5. insurer_contract_periods
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| insurer_id | bigint | |
| valid_from | date | inkluzivně |
| valid_to | date nullable | inkluzivně, nullable = otevřeno |
| created_by | bigint | uživatel |
| created_at | datetime | |
| updated_at | datetime | |

## 6. patient_identity_exceptions
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| patient_a_id | bigint | |
| patient_b_id | bigint | |
| confirmed_by | bigint | |
| confirmed_at | datetime | |
| note | text nullable | |

## 7. day_templates
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| therapist_id | bigint | |
| day_of_week | tinyint | 0-6 |
| start_time | time | |
| end_time | time | |
| valid_from | date | |
| valid_to | date nullable | |
| is_active | boolean | |
| created_by | bigint | |
| created_at | datetime | |

`day_templates` může obsahovat více nekolizních řádků pro stejný den týdne; mezera mezi nimi představuje přestávku.

## 7a. schedule_templates
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | pojmenovaná znovu použitelná šablona |
| therapist_id | bigint | vlastník šablony |
| name | varchar(120) | unikátní v rámci terapeutky |
| is_active | boolean | deaktivace bez mazání |
| created_by | bigint | |
| created_at | datetime | |

## 7b. schedule_template_intervals
| sloupec | typ | poznámka |
| --- | --- | --- |
| template_id | bigint | FK na `schedule_templates` |
| day_of_week | tinyint | den týdne |
| start_time | time | pracovní interval |
| end_time | time | pracovní interval |
| interval_order | tinyint | pořadí v rámci dne |

## 8. schedule_overrides
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| therapist_id | bigint | |
| override_date | date | |
| start_time | time nullable | |
| end_time | time nullable | |
| is_day_off | boolean | |
| created_by | bigint | |
| created_at | datetime | |

## 8a. schedule_override_intervals
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| override_id | bigint | FK na `schedule_overrides` |
| start_time | time | |
| end_time | time | |
| interval_order | tinyint | pořadí v rámci dne |

Starší `start_time`/`end_time` ve výjimce zůstávají jako kompatibilní fallback.

## 9. holidays
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| holiday_date | date | |
| name | varchar(128) | |
| source | varchar(64) | |
| created_at | datetime | |

## 10. reservations
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| patient_id | bigint | |
| therapist_id | bigint | |
| start_at | datetime | |
| end_at | datetime | |
| duration_minutes | smallint | 45 nebo 60 |
| status | enum('ACTIVE','EXCUSED','CANCELLED') | |
| original_reservation_id | bigint nullable | náhradní termín |
| created_by | bigint | |
| created_at | datetime | |
| updated_at | datetime | |

## 11. reservation_events
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| reservation_id | bigint | |
| event_type | varchar(64) | created, updated, excused, cancelled |
| actor_user_id | bigint | |
| event_at | datetime | |
| old_values | json | |
| new_values | json | |

## 12. active_sessions
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| user_id | bigint | |
| session_id_hash | varchar(255) | hash session ID |
| user_agent_hash | varchar(255) | |
| device_label | varchar(128) nullable | |
| created_at | datetime | |
| last_seen_at | datetime | |
| expires_at | datetime | |
| revoked_at | datetime nullable | |
| is_revoked | boolean | |

## 13. audit_log
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| entity_type | varchar(64) | |
| entity_id | bigint | |
| action | varchar(64) | |
| actor_user_id | bigint | |
| actor_role | varchar(32) | |
| created_at | datetime | |
| old_values | json nullable | |
| new_values | json nullable | |
| request_id | varchar(64) | |
| source_ip_hash | varchar(255) nullable | |
| user_agent_hash | varchar(255) nullable | |

## 14. rate_limit_log
| sloupec | typ | poznámka |
| --- | --- | --- |
| id | bigint PK | |
| key | varchar(128) | login key / IP key |
| count | int | |
| window_start | datetime | |
| created_at | datetime | |
