-- Bootstrap SQL run once by the postgres container on first start.
-- Table creation itself is handled by SQLAlchemy (app.db.database.init_models)
-- on backend startup; this file only sets up extensions the app relies on.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
